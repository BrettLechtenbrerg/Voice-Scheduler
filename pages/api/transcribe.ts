import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { prisma } from '../../lib/prisma'
import { ensureUserHasWorkspace } from '../../lib/workspace'
import OpenAI from 'openai';
import formidable from 'formidable';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ContactData {
  name: string;
  phone: string;
  email: string;
  company?: string;
  notes?: string;
}

function sanitizeInput(input: string, preserveEmail: boolean = false): string {
  if (!input || typeof input !== 'string') return '';
  // Remove potentially dangerous characters and limit length
  if (preserveEmail) {
    // Less aggressive sanitization for emails
    return input
      .replace(/[<>'"&]/g, '') // Remove HTML/script injection characters
      .slice(0, 1000) // Limit length
      .trim();
  }
  return input
    .replace(/[<>'"&]/g, '') // Remove HTML/script injection characters
    .replace(/[^\w\s@.-]/g, '') // Allow only alphanumeric, whitespace, @, ., -
    .slice(0, 1000) // Limit length
    .trim();
}

function parseContactInfo(transcription: string): ContactData {
  // Sanitize input first
  const cleanTranscription = sanitizeInput(transcription);
  
  const result: ContactData = {
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: cleanTranscription,
  };

  // Extract phone numbers (various formats) from clean transcription
  const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const phoneMatch = cleanTranscription.match(phoneRegex);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/\D/g, '');
    if (result.phone.length === 10) {
      result.phone = `+1${result.phone}`;
    }
  }

  // Extract email addresses from clean transcription
  // First try standard @ format
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = cleanTranscription.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  } else {
    // Try "at" format with "dot com" spelled out
    const voiceEmailDotRegex = /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+(com|net|org|edu|gov|co\.uk|io)/i;
    const voiceEmailDotMatch = cleanTranscription.match(voiceEmailDotRegex);
    if (voiceEmailDotMatch) {
      result.email = `${voiceEmailDotMatch[1]}@${voiceEmailDotMatch[2]}.${voiceEmailDotMatch[3]}`.toLowerCase();
    } else {
      // Try "at" format with domain
      const voiceEmailRegex = /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
      const voiceEmailMatch = cleanTranscription.match(voiceEmailRegex);
      if (voiceEmailMatch) {
        result.email = `${voiceEmailMatch[1]}@${voiceEmailMatch[2]}`.toLowerCase();
      }
    }
  }

  // Extract names - handle multiple patterns
  let nameFound = false;
  
  // Pattern 1: "First name [Name], last name [Name]"
  const firstLastRegex = /(?:first name|first)\s+([A-Z][a-z]+)(?:.*?(?:last name|last)\s+([A-Z][a-z]+))?/i;
  const firstLastMatch = cleanTranscription.match(firstLastRegex);
  if (firstLastMatch) {
    const firstName = sanitizeInput(firstLastMatch[1]);
    const lastName = sanitizeInput(firstLastMatch[2] || '');
    result.name = lastName ? `${firstName} ${lastName}` : firstName;
    nameFound = true;
  }
  
  // Pattern 2: "with [Name]" pattern (common in introductions)
  if (!nameFound) {
    const withNameRegex = /(?:with|meeting|speaking with|talking to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:,|\s+(?:from|at|and|phone|email)|$)/i;
    const withNameMatch = cleanTranscription.match(withNameRegex);
    if (withNameMatch) {
      result.name = sanitizeInput(withNameMatch[1]);
      nameFound = true;
    }
  }
  
  // Pattern 3: "My name is [Name]" or "This is [Name]"
  if (!nameFound) {
    const nameRegex = /(?:name is|my name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
    const nameMatch = cleanTranscription.match(nameRegex);
    if (nameMatch) {
      result.name = sanitizeInput(nameMatch[1]);
      nameFound = true;
    }
  }
  
  // Pattern 4: Fallback - first capitalized words
  if (!nameFound) {
    const firstWordsRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
    const firstWordsMatch = cleanTranscription.match(firstWordsRegex);
    if (firstWordsMatch) {
      result.name = sanitizeInput(firstWordsMatch[1]);
    }
  }

  // Extract company mentions - multiple patterns
  let companyFound = false;
  
  // Pattern 1: "company name [Company]"
  const companyNameRegex = /company name[,\s]+([A-Z][a-zA-Z\s&.,-]+?)(?:[,\s]*(?:please|phone|email|$))/i;
  const companyNameMatch = cleanTranscription.match(companyNameRegex);
  if (companyNameMatch) {
    result.company = sanitizeInput(companyNameMatch[1]);
    companyFound = true;
  }
  
  // Pattern 2: Standard company patterns
  if (!companyFound) {
    const companyRegex = /(?:from|at|with|work for|work at)\s+([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Company|Co\.|Ltd)?)/i;
    const companyMatch = cleanTranscription.match(companyRegex);
    if (companyMatch) {
      result.company = sanitizeInput(companyMatch[1]);
      companyFound = true;
    }
  }
  
  // Pattern 3: Simple "ABC Company" pattern - more precise
  if (!companyFound) {
    const simpleCompanyRegex = /(?:^|\s)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Solutions|Business|Services|Company|Inc|LLC|Corp))(?:\s|$|,)/;
    const simpleCompanyMatch = cleanTranscription.match(simpleCompanyRegex);
    if (simpleCompanyMatch) {
      result.company = sanitizeInput(simpleCompanyMatch[1]);
    }
  }

  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
      filter: function ({ name, mimetype }) {
        // Only allow audio files
        return !!(
          name === 'audio' && 
          mimetype && 
          (mimetype.startsWith('audio/') || mimetype === 'application/octet-stream')
        );
      },
    });

    const [, files] = await form.parse(req);
    
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get API key from environment only - no client-side API keys
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'Server configuration error - please contact administrator'
      });
    }

    // Create OpenAI instance with provided or environment API key
    const openaiInstance = new OpenAI({
      apiKey: apiKey,
    });

    // Use the file path for OpenAI
    const transcription = await openaiInstance.audio.transcriptions.create({
      file: require('fs').createReadStream(audioFile.filepath),
      model: 'whisper-1',
      language: 'en',
    });

    // Parse contact information
    const contactData = parseContactInfo(transcription.text);

    // Get user's workspace for usage tracking
    const workspace = await ensureUserHasWorkspace(session);
    if (workspace) {
      // Log usage for analytics
      await prisma.usageLog.create({
        data: {
          workspaceId: workspace.id,
          userId: session.user.id,
          action: 'transcribe',
          metadata: {
            transcriptionLength: transcription.text.length,
            contactDataExtracted: !!(contactData.name && contactData.phone)
          }
        }
      });
    }

    return res.status(200).json({
      transcription: transcription.text,
      contactData,
      success: true,
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}