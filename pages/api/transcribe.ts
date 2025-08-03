import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import multer from 'multer';
import { promisify } from 'util';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const uploadMiddleware = promisify(upload.single('audio'));

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

function parseContactInfo(transcription: string): ContactData {
  const result: ContactData = {
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: transcription,
  };

  // Extract phone numbers (various formats)
  const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const phoneMatch = transcription.match(phoneRegex);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/\D/g, '');
    if (result.phone.length === 10) {
      result.phone = `+1${result.phone}`;
    }
  }

  // Extract email addresses
  // First try standard @ format
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = transcription.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0];
  } else {
    // Try "at" format (voice transcription often says "at" instead of "@")
    const voiceEmailRegex = /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const voiceEmailMatch = transcription.match(voiceEmailRegex);
    if (voiceEmailMatch) {
      result.email = `${voiceEmailMatch[1]}@${voiceEmailMatch[2]}`;
    }
  }

  // Extract names (simple approach - first capitalized words)
  const nameRegex = /(?:name is|I'm|my name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
  const nameMatch = transcription.match(nameRegex);
  if (nameMatch) {
    result.name = nameMatch[1];
  } else {
    // Fallback: look for capitalized words at the beginning
    const firstWordsRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
    const firstWordsMatch = transcription.match(firstWordsRegex);
    if (firstWordsMatch) {
      result.name = firstWordsMatch[1];
    }
  }

  // Extract company mentions
  const companyRegex = /(?:from|at|with|work for|work at)\s+([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Company|Co\.|Ltd)?)/i;
  const companyMatch = transcription.match(companyRegex);
  if (companyMatch) {
    result.company = companyMatch[1].trim();
  } else {
    // Try simple "ABC Company" pattern
    const simpleCompanyRegex = /([A-Z][A-Z]+\s+Company)/;
    const simpleCompanyMatch = transcription.match(simpleCompanyRegex);
    if (simpleCompanyMatch) {
      result.company = simpleCompanyMatch[1];
    }
  }

  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await uploadMiddleware(req as any, res as any);
    
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get API key from request body or environment
    const apiKey = (req as any).body?.apiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'OpenAI API key is required',
        details: 'Please provide an API key in testing mode or configure OPENAI_API_KEY environment variable'
      });
    }

    // Create OpenAI instance with provided or environment API key
    const openaiInstance = new OpenAI({
      apiKey: apiKey,
    });

    // Convert buffer to file-like object for OpenAI
    const audioFile = new File([file.buffer], file.originalname || 'audio.webm', {
      type: file.mimetype || 'audio/webm',
    });

    // Transcribe with Whisper
    const transcription = await openaiInstance.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    // Parse contact information
    const contactData = parseContactInfo(transcription.text);

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