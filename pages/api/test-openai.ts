import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'API key missing or placeholder'
      });
    }
    
    if (!apiKey.startsWith('sk-')) {
      return res.status(500).json({ 
        error: 'Invalid API key format',
        details: 'OpenAI API key must start with sk-'
      });
    }

    console.log('Testing OpenAI API connection...');
    console.log('API Key format:', `${apiKey.substring(0, 10)}...`);
    
    const openaiInstance = new OpenAI({
      apiKey: apiKey,
    });

    // Test with a simple models list call (doesn't use credits)
    console.log('Making request to OpenAI API...');
    const models = await openaiInstance.models.list();
    
    console.log('OpenAI API test successful');
    console.log('Available models:', models.data.length);
    
    // Check if whisper-1 model is available
    const whisperModel = models.data.find(model => model.id === 'whisper-1');
    
    return res.status(200).json({
      success: true,
      apiKeyFormat: 'Valid (starts with sk-)',
      modelsAvailable: models.data.length,
      whisperAvailable: !!whisperModel,
      whisperModel: whisperModel ? {
        id: whisperModel.id,
        created: whisperModel.created,
        owned_by: whisperModel.owned_by
      } : null
    });

  } catch (error) {
    console.error('OpenAI API test failed:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    
    let errorMessage = 'OpenAI API test failed';
    let errorDetails = 'Unknown error';
    let networkInfo = {};
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      errorDetails = error.message;
      
      // Check for specific network errors
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        errorMessage = 'DNS resolution failed';
        errorDetails = 'Cannot resolve api.openai.com - DNS or network issue';
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('Connection refused')) {
        errorMessage = 'Connection refused';
        errorDetails = 'OpenAI API server refused connection';
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        errorMessage = 'Connection timeout';
        errorDetails = 'Request to OpenAI API timed out';
      } else if (error.message.includes('ECONNRESET')) {
        errorMessage = 'Connection reset';
        errorDetails = 'Connection to OpenAI API was reset';
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'OpenAI API authentication failed';
        errorDetails = 'Invalid API key - check your OpenAI API key';
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorMessage = 'OpenAI API access denied';
        errorDetails = 'API key does not have sufficient permissions';
      } else if (error.message.includes('429') || error.message.includes('rate')) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'Too many requests, please try again later';
      } else if (error.message.includes('insufficient') || error.message.includes('quota')) {
        errorMessage = 'OpenAI API quota exceeded';
        errorDetails = 'Insufficient credits or billing limits reached';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error';
        errorDetails = `Network request failed: ${error.message}`;
      }
    }
    
    // Log additional error context
    if ((error as any)?.cause) {
      console.error('Error cause:', (error as any).cause);
      networkInfo = { cause: (error as any).cause };
    }
    
    if ((error as any)?.response) {
      console.error('API response status:', (error as any).response.status);
      console.error('API response data:', (error as any).response.data);
      networkInfo = { 
        ...networkInfo, 
        status: (error as any).response.status,
        statusText: (error as any).response.statusText
      };
    }
    
    if ((error as any)?.code) {
      console.error('Error code:', (error as any).code);
      networkInfo = { ...networkInfo, code: (error as any).code };
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      rawError: error instanceof Error ? error.message : String(error),
      networkInfo: Object.keys(networkInfo).length > 0 ? networkInfo : undefined
    });
  }
}