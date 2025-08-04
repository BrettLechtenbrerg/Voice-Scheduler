const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const { promisify } = require('util');

const app = express();
const PORT = 8080;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const uploadMiddleware = promisify(upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'apiKey', maxCount: 1 }
]));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Contact parsing function
function parseContactInfo(transcription) {
  const result = {
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
  const emailRegex = /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = transcription.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0];
  } else {
    // Try "at" format
    const voiceEmailRegex = /([a-zA-Z0-9._%-]+)\s+at\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const voiceEmailMatch = transcription.match(voiceEmailRegex);
    if (voiceEmailMatch) {
      result.email = `${voiceEmailMatch[1]}@${voiceEmailMatch[2]}`;
    }
  }

  // Extract names
  let nameFound = false;
  
  // Pattern 1: "First name [Name], last name [Name]"
  const firstLastRegex = /(?:first name|first)\s+([A-Z][a-z]+)(?:.*?(?:last name|last)\s+([A-Z][a-z]+))?/i;
  const firstLastMatch = transcription.match(firstLastRegex);
  if (firstLastMatch) {
    const firstName = firstLastMatch[1];
    const lastName = firstLastMatch[2] || '';
    result.name = lastName ? `${firstName} ${lastName}` : firstName;
    nameFound = true;
  }
  
  // Pattern 2: "My name is [Name]" or "This is [Name]"
  if (!nameFound) {
    const nameRegex = /(?:name is|I'm|my name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
    const nameMatch = transcription.match(nameRegex);
    if (nameMatch) {
      result.name = nameMatch[1];
      nameFound = true;
    }
  }
  
  // Pattern 3: Fallback - first capitalized words
  if (!nameFound) {
    const firstWordsRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
    const firstWordsMatch = transcription.match(firstWordsRegex);
    if (firstWordsMatch) {
      result.name = firstWordsMatch[1];
    }
  }

  // Extract company mentions
  let companyFound = false;
  
  const companyNameRegex = /company name[,\s]+([A-Z][a-zA-Z\s&.,-]+?)(?:[,\s]*(?:please|phone|email|$))/i;
  const companyNameMatch = transcription.match(companyNameRegex);
  if (companyNameMatch) {
    result.company = companyNameMatch[1].trim();
    companyFound = true;
  }
  
  if (!companyFound) {
    const companyRegex = /(?:from|at|with|work for|work at)\s+([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Company|Co\.|Ltd)?)/i;
    const companyMatch = transcription.match(companyRegex);
    if (companyMatch) {
      result.company = companyMatch[1].trim();
      companyFound = true;
    }
  }
  
  if (!companyFound) {
    const simpleCompanyRegex = /([A-Z][a-zA-Z\s]+(?:Company|Solutions|Business|Inc|LLC|Corp))/;
    const simpleCompanyMatch = transcription.match(simpleCompanyRegex);
    if (simpleCompanyMatch) {
      result.company = simpleCompanyMatch[1].trim();
    }
  }

  return result;
}

// Transcribe endpoint
app.post('/api/transcribe', async (req, res) => {
  try {
    await uploadMiddleware(req, res);
    
    const files = req.files;
    const audioFile = files?.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get API key from form fields
    const apiKeyField = files?.apiKey?.[0];
    const apiKey = apiKeyField ? apiKeyField.buffer.toString('utf8') : process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'OpenAI API key is required',
        details: 'Please provide an API key in testing mode or configure OPENAI_API_KEY environment variable'
      });
    }

    // Create OpenAI instance
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Convert buffer to file-like object for OpenAI
    const audioFileForAPI = new File([audioFile.buffer], audioFile.originalname || 'audio.webm', {
      type: audioFile.mimetype || 'audio/webm',
    });

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFileForAPI,
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
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('CORS enabled for cross-origin requests');
});