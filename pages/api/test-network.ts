import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tests = [];

  // Test 1: Basic fetch to OpenAI API
  try {
    console.log('Testing basic fetch to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      // timeout handled by serverless function timeout
    });
    
    const testResult: any = {
      test: 'Basic fetch to OpenAI API',
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    };
    
    if (response.ok) {
      const data = await response.json();
      testResult.dataReceived = data.data?.length || 0;
    } else {
      const errorText = await response.text();
      testResult.errorBody = errorText;
    }
    
    tests.push(testResult);
  } catch (error) {
    tests.push({
      test: 'Basic fetch to OpenAI API',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
      errorCode: (error as any)?.code,
      errorCause: (error as any)?.cause
    });
  }

  // Test 2: DNS resolution test
  try {
    console.log('Testing DNS resolution...');
    const response = await fetch('https://api.openai.com', {
      method: 'HEAD',
      // timeout handled by serverless function
    });
    
    tests.push({
      test: 'DNS resolution test',
      success: true,
      status: response.status,
      resolved: true
    });
  } catch (error) {
    tests.push({
      test: 'DNS resolution test', 
      success: false,
      error: error instanceof Error ? error.message : String(error),
      resolved: false
    });
  }

  // Test 3: Alternative API test (to rule out general network issues)
  try {
    console.log('Testing alternative API...');
    const response = await fetch('https://httpbin.org/get', {
      // timeout handled by serverless function
    });
    
    tests.push({
      test: 'Alternative API test (httpbin)',
      success: response.ok,
      status: response.status
    });
  } catch (error) {
    tests.push({
      test: 'Alternative API test (httpbin)',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      region: process.env.VERCEL_REGION || 'unknown'
    },
    tests
  });
}