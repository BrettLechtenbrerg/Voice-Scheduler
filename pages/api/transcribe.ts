import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { prisma } from '../../lib/prisma'
import { ensureUserHasWorkspace } from '../../lib/workspace'
// Removed OpenAI SDK - using direct REST API
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

  // Extract phone numbers - enhanced patterns for voice recognition
  let phoneFound = false;
  
  // Pattern 1: Standard numeric phone patterns
  const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
  let phoneMatch;
  while ((phoneMatch = phoneRegex.exec(cleanTranscription)) !== null) {
    let phone = phoneMatch[0].replace(/\D/g, '');
    if (phone.length === 10) {
      phone = `+1${phone}`;
    }
    if (phone.length === 11 && phone.startsWith('1')) {
      phone = `+${phone}`;
    }
    result.phone = phone;
    phoneFound = true;
    break; // Take the first valid phone number
  }
  
  // Pattern 2: Voice-to-text phone patterns (e.g., "five five five one two three four")
  if (!phoneFound) {
    const digitWords: { [key: string]: string } = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
      'oh': '0', 'to': '2', 'too': '2', 'for': '4', 'ate': '8'
    };
    
    const digitWordsRegex = new RegExp(`\\b(${Object.keys(digitWords).join('|')})\\b`, 'gi');
    const digitMatches = cleanTranscription.match(digitWordsRegex);
    if (digitMatches && digitMatches.length >= 10) {
      const phoneDigits = digitMatches.slice(0, 10).map(word => digitWords[word.toLowerCase()]).join('');
      if (/^\d{10}$/.test(phoneDigits)) {
        result.phone = `+1${phoneDigits}`;
        phoneFound = true;
      }
    }
  }

  // Extract email addresses - enhanced patterns for voice recognition
  let emailFound = false;
  
  // Pattern 1: Standard @ format
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = cleanTranscription.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
    emailFound = true;
  }
  
  if (!emailFound) {
    // Pattern 2: "at" format with "dot" spelled out (john at gmail dot com)
    const voiceEmailDotRegex = /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+(com|net|org|edu|gov|co\.uk|io|mil|biz|info)/i;
    const voiceEmailDotMatch = cleanTranscription.match(voiceEmailDotRegex);
    if (voiceEmailDotMatch) {
      result.email = `${voiceEmailDotMatch[1]}@${voiceEmailDotMatch[2]}.${voiceEmailDotMatch[3]}`.toLowerCase();
      emailFound = true;
    }
  }
  
  if (!emailFound) {
    // Pattern 3: "at" format with domain (john at gmail.com)
    const voiceEmailRegex = /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const voiceEmailMatch = cleanTranscription.match(voiceEmailRegex);
    if (voiceEmailMatch) {
      result.email = `${voiceEmailMatch[1]}@${voiceEmailMatch[2]}`.toLowerCase();
      emailFound = true;
    }
  }
  
  if (!emailFound) {
    // Pattern 4: Handle spaces in email addresses (j o h n at g m a i l dot c o m)
    const spacedEmailRegex = /([a-zA-Z]\s+[a-zA-Z](?:\s+[a-zA-Z])*)\s+at\s+([a-zA-Z](?:\s+[a-zA-Z])*)\s+dot\s+([a-zA-Z](?:\s+[a-zA-Z])*)/i;
    const spacedEmailMatch = cleanTranscription.match(spacedEmailRegex);
    if (spacedEmailMatch) {
      const username = spacedEmailMatch[1].replace(/\s+/g, '');
      const domain = spacedEmailMatch[2].replace(/\s+/g, '');
      const tld = spacedEmailMatch[3].replace(/\s+/g, '');
      result.email = `${username}@${domain}.${tld}`.toLowerCase();
      emailFound = true;
    }
  }
  
  if (!emailFound) {
    // Pattern 5: Email spelled out completely (my email is j-o-h-n at g-m-a-i-l dot c-o-m)
    const spelledEmailRegex = /email\s+is\s+([a-zA-Z](?:[-\s][a-zA-Z])*)\s+at\s+([a-zA-Z](?:[-\s][a-zA-Z])*)\s+dot\s+([a-zA-Z](?:[-\s][a-zA-Z])*)/i;
    const spelledEmailMatch = cleanTranscription.match(spelledEmailRegex);
    if (spelledEmailMatch) {
      const username = spelledEmailMatch[1].replace(/[-\s]/g, '');
      const domain = spelledEmailMatch[2].replace(/[-\s]/g, '');
      const tld = spelledEmailMatch[3].replace(/[-\s]/g, '');
      result.email = `${username}@${domain}.${tld}`.toLowerCase();
      emailFound = true;
    }
  }

  // Extract names - enhanced patterns for voice recognition
  let nameFound = false;
  
  // Pattern 1: "First name [Name], last name [Name]" or variations
  const firstLastRegex = /(?:first name|first)\s+(?:is\s+)?([A-Z][a-z]+)(?:.*?(?:last name|last)\s+(?:is\s+)?([A-Z][a-z]+))?/i;
  const firstLastMatch = cleanTranscription.match(firstLastRegex);
  if (firstLastMatch) {
    const firstName = sanitizeInput(firstLastMatch[1]);
    const lastName = sanitizeInput(firstLastMatch[2] || '');
    result.name = lastName ? `${firstName} ${lastName}` : firstName;
    nameFound = true;
  }
  
  // Pattern 2: "My name is [Full Name]" or "This is [Full Name]" - prioritize full names
  if (!nameFound) {
    const fullNameRegex = /(?:my name is|name is|this is|i am|i'm)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
    const fullNameMatch = cleanTranscription.match(fullNameRegex);
    if (fullNameMatch) {
      result.name = sanitizeInput(fullNameMatch[1]);
      nameFound = true;
    }
  }
  
  // Pattern 3: Single name introduction
  if (!nameFound) {
    const singleNameRegex = /(?:my name is|name is|this is|i am|i'm)\s+([A-Z][a-z]+)/i;
    const singleNameMatch = cleanTranscription.match(singleNameRegex);
    if (singleNameMatch) {
      result.name = sanitizeInput(singleNameMatch[1]);
      nameFound = true;
    }
  }
  
  // Pattern 4: "with [Name]" or "for [Name]" pattern (common in introductions)
  if (!nameFound) {
    const withNameRegex = /(?:with|for|meeting|speaking with|talking to|on behalf of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
    const withNameMatch = cleanTranscription.match(withNameRegex);
    if (withNameMatch) {
      result.name = sanitizeInput(withNameMatch[1]);
      nameFound = true;
    }
  }
  
  // Pattern 5: "Hello, [Name] here" or "[Name] calling"
  if (!nameFound) {
    const callingRegex = /(?:hello|hi),?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:here|calling|speaking)/i;
    const callingMatch = cleanTranscription.match(callingRegex);
    if (callingMatch) {
      result.name = sanitizeInput(callingMatch[1]);
      nameFound = true;
    }
  }
  
  // Pattern 6: "Contact name is [Name]" or "Name for contact is [Name]"
  if (!nameFound) {
    const contactNameRegex = /(?:contact name|name for contact|contact)\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
    const contactNameMatch = cleanTranscription.match(contactNameRegex);
    if (contactNameMatch) {
      result.name = sanitizeInput(contactNameMatch[1]);
      nameFound = true;
    }
  }
  
  // Pattern 7: Fallback - first capitalized words (only if no other patterns match)
  if (!nameFound) {
    const firstWordsRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
    const firstWordsMatch = cleanTranscription.match(firstWordsRegex);
    if (firstWordsMatch) {
      // Only use this if it looks like a real name (not common words)
      const potentialName = sanitizeInput(firstWordsMatch[1]);
      const commonWords = ['Hello', 'Hi', 'Yes', 'No', 'Okay', 'Please', 'Thank', 'Sorry', 'Excuse'];
      if (!commonWords.some(word => potentialName.toLowerCase().includes(word.toLowerCase()))) {
        result.name = potentialName;
      }
    }
  }

  // Extract company mentions - ULTRA PRECISE patterns to avoid over-capture
  let companyFound = false;
  
  // Helper function to validate and clean company names
  function validateCompanyName(companyName: string): string | null {
    if (!companyName || typeof companyName !== 'string') return null;
    
    let cleaned = companyName.trim();
    
    // Remove common trailing words that indicate end of company name
    const trailingWords = /\s+(and|please|phone|email|contact|my|her|his|their|the|a|an|is|was|are|were|will|would|should|could|can|may|might|has|have|had|do|does|did|get|got|go|goes|went|come|comes|came|take|takes|took|make|makes|made|see|sees|saw|know|knows|knew|think|thinks|thought|say|says|said|tell|tells|told|give|gives|gave|put|puts|put|use|uses|used|work|works|worked|call|calls|called|help|helps|helped|try|tries|tried).*$/i;
    cleaned = cleaned.replace(trailingWords, '');
    
    // Must be 3-25 characters (very restrictive)
    if (cleaned.length < 3 || cleaned.length > 25) return null;
    
    // Must not be common words
    const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'them', 'they', 'there', 'their', 'then', 'than', 'when', 'where', 'what', 'which', 'who', 'why', 'how', 'can', 'will', 'would', 'should', 'could', 'may', 'might', 'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'go', 'come', 'take', 'make', 'see', 'know', 'think', 'say', 'tell', 'give', 'put', 'use', 'work', 'call', 'help', 'try'];
    const firstWord = cleaned.split(' ')[0].toLowerCase();
    if (commonWords.includes(firstWord)) return null;
    
    // Must have reasonable word count (1-3 words max)
    const words = cleaned.split(' ').filter(w => w.length > 0);
    if (words.length > 3) return null;
    
    return cleaned;
  }
  
  // Pattern 1: Explicit company mention - VERY restrictive
  const companyNameRegex = /(?:company name|company|organization|business|employer)\s+(?:is\s+)?([A-Z][a-zA-Z\s&.-]{2,20})(?:\b|$|[,.])/i;
  const companyNameMatch = cleanTranscription.match(companyNameRegex);
  if (companyNameMatch) {
    const validated = validateCompanyName(companyNameMatch[1]);
    if (validated) {
      result.company = validated;
      companyFound = true;
    }
  }
  
  // Pattern 2: "I work at/for [Company]" - VERY restrictive
  if (!companyFound) {
    const workAtRegex = /(?:i work|work|working|employed)\s+(?:at|for|with)\s+([A-Z][a-zA-Z\s&.-]{2,20})(?:\b|$|[,.])/i;
    const workAtMatch = cleanTranscription.match(workAtRegex);
    if (workAtMatch) {
      const validated = validateCompanyName(workAtMatch[1]);
      if (validated) {
        result.company = validated;
        companyFound = true;
      }
    }
  }
  
  // Pattern 3: "I'm with/from [Company]" - VERY restrictive  
  if (!companyFound) {
    const withRegex = /(?:i'm with|im with|i am with|i'm from|im from|i am from)\s+([A-Z][a-zA-Z\s&.-]{2,20})(?:\b|$|[,.])/i;
    const withMatch = cleanTranscription.match(withRegex);
    if (withMatch) {
      const validated = validateCompanyName(withMatch[1]);
      if (validated) {
        result.company = validated;
        companyFound = true;
      }
    }
  }
  
  // Pattern 4: Company with standard suffixes - Most reliable
  if (!companyFound) {
    const suffixRegex = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\s+(Inc|LLC|Corp|Corporation|Company|Co\.|Ltd|Limited|Solutions|Services|Group|Associates|Partners|Consulting)\b/;
    const suffixMatch = cleanTranscription.match(suffixRegex);
    if (suffixMatch) {
      const companyWithSuffix = `${suffixMatch[1]} ${suffixMatch[2]}`;
      if (companyWithSuffix.length <= 25) {
        result.company = companyWithSuffix.trim();
        companyFound = true;
      }
    }
  }
  
  // Pattern 5: Business type descriptors - Very selective
  if (!companyFound) {
    const businessTypeRegex = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,1})\s+(Martial Arts|Real Estate|Law Firm|Medical|Dental|Consulting|Marketing|Insurance|Finance|Academy|Studio|Clinic)\b/i;
    const businessTypeMatch = cleanTranscription.match(businessTypeRegex);
    if (businessTypeMatch) {
      const companyWithType = `${businessTypeMatch[1]} ${businessTypeMatch[2]}`;
      if (companyWithType.length <= 25) {
        result.company = companyWithType.trim();
        companyFound = true;
      }
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
    
    console.log('Audio file received:', {
      filename: audioFile.originalFilename,
      size: audioFile.size,
      mimetype: audioFile.mimetype,
      filepath: audioFile.filepath
    });
    
    // Validate file size
    if (audioFile.size === 0) {
      return res.status(400).json({ 
        error: 'Empty audio file',
        details: 'The audio file is empty. Please record some audio before submitting.'
      });
    }

    // Get API key from environment only - no client-side API keys
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      console.error('OpenAI API key missing or placeholder:', apiKey ? 'placeholder' : 'missing');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'Server configuration error - please contact administrator'
      });
    }
    
    if (!apiKey.startsWith('sk-')) {
      console.error('Invalid OpenAI API key format');
      return res.status(500).json({ 
        error: 'Invalid API key format',
        details: 'OpenAI API key must start with sk-'
      });
    }

    // BACK TO BASICS: Use OpenAI SDK with file stream (we know this works)
    console.log('Back to OpenAI SDK with file stream...');
    console.log('File path:', audioFile.filepath);
    
    const OpenAI = require('openai');
    
    // Create OpenAI instance
    const openai = new OpenAI({
      apiKey: apiKey.trim(), // Trim any whitespace
    });

    // Create the transcription using file stream
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.filepath),
      model: 'whisper-1',
      language: 'en',
    });
    
    console.log('Transcription result:', transcription);
    
    // Get the text from the transcription result
    const transcriptionText = transcription.text;
    console.log('Transcription text:', transcriptionText);
    const contactData = parseContactInfo(transcriptionText);

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
            transcriptionLength: transcriptionText.length,
            contactDataExtracted: !!(contactData.name && contactData.phone)
          }
        }
      });
    }

    return res.status(200).json({
      transcription: transcriptionText,
      contactData,
      success: true,
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to transcribe audio';
    let errorDetails = 'Unknown error';
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      errorDetails = error.message;
      
      // Check for specific OpenAI API errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'OpenAI API authentication failed';
        errorDetails = 'Invalid API key or insufficient credits - check your OpenAI billing';
      } else if (error.message.includes('429') || error.message.includes('rate')) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'Too many requests, please try again later';
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorMessage = 'OpenAI API access denied';
        errorDetails = 'API key does not have access to Whisper API or billing not set up';
      } else if (error.message.includes('insufficient') || error.message.includes('quota')) {
        errorMessage = 'OpenAI API quota exceeded';
        errorDetails = 'Insufficient credits or billing limits reached';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = 'Network connection failed';
        errorDetails = 'Unable to connect to OpenAI API';
      }
    }
    
    // Log additional error context
    if ((error as any)?.response) {
      console.error('API response status:', (error as any).response.status);
      console.error('API response data:', (error as any).response.data);
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      rawError: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}