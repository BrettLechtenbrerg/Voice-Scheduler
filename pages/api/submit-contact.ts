import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface ContactSubmission {
  name: string;
  phone: string;
  email: string;
  company?: string;
  notes?: string;
}

interface GHLFormSubmission {
  name: string;
  phone: string;
  email: string;
  company?: string;
  message?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const contactData: ContactSubmission = req.body;
    
    console.log('Received contact data:', contactData);

    // Validate required fields
    if (!contactData.name || !contactData.phone) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'phone'],
        received: contactData
      });
    }

    // Submit to Go High Level
    const ghlFormUrl = process.env.GHL_FORM_URL || 'https://api.leadconnectorhq.com/widget/form/fLVbcMPIRtUrfEIPkyGF';
    
    console.log('Submitting to GHL form:', ghlFormUrl);
    
    // Try to make the submission as close to a real browser form as possible
    const ghlData = {
      // Core form fields (matching the actual form structure)
      first_name: contactData.name.split(' ')[0] || contactData.name,
      last_name: contactData.name.split(' ').slice(1).join(' ') || '',
      phone: contactData.phone,
      email: contactData.email || '',
      company_name: contactData.company || '',
      
      // Form identification and submission context
      'form-id': 'fLVbcMPIRtUrfEIPkyGF',
      'location-id': process.env.GHL_LOCATION_ID || 'boPxhNvcNB6T3F2CLP0M',
      
      // Add common form fields that might be required for workflow triggers
      source: 'form_submission',
      medium: 'widget',
      campaign: 'voice_scheduler',
      
      // Browser context that might be needed
      page_title: 'Voice Scheduler',
      page_url: 'https://voice-scheduler.vercel.app',
      referrer: '',
      
      // Timestamp for tracking
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('Submitting exact GHL form data:', ghlData);

    let formResponse;
    
    // Try form-encoded submission (most common for GHL forms)
    try {
      const formDataString = Object.entries(ghlData)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            // Handle arrays (like multiple checkboxes)
            return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`).join('&');
          }
          return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
        })
        .join('&');
      
      console.log('Form data string:', formDataString);
      
      formResponse = await axios.post(ghlFormUrl, formDataString, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://voice-scheduler.vercel.app',
          'Referer': 'https://voice-scheduler.vercel.app/',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        },
        timeout: 15000,
        maxRedirects: 0, // Don't follow redirects - we want to see the redirect response
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects as success
        }
      });

      console.log('GHL Form response:', formResponse.status, formResponse.data);
      console.log('GHL Response headers:', formResponse.headers);
      console.log('GHL Response config:', {
        url: formResponse.config?.url,
        method: formResponse.config?.method,
        headers: formResponse.config?.headers
      });
      
    } catch (formError) {
      console.log('Form submission failed, trying JSON format');
      
      // Fallback to JSON
      formResponse = await axios.post(ghlFormUrl, ghlData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 15000,
      });

      console.log('GHL JSON response:', formResponse.status, formResponse.data);
      console.log('GHL JSON Response headers:', formResponse.headers);
    }

    // Detailed analysis of the response
    const responseAnalysis = {
      status: formResponse.status,
      statusText: formResponse.statusText,
      headers: formResponse.headers,
      data: formResponse.data,
      dataType: typeof formResponse.data,
      dataString: JSON.stringify(formResponse.data),
      url: formResponse.config?.url
    };
    
    console.log('=== DETAILED GHL RESPONSE ANALYSIS ===');
    console.log('Status:', responseAnalysis.status, responseAnalysis.statusText);
    console.log('Response Headers:', responseAnalysis.headers);
    console.log('Response Data:', responseAnalysis.data);
    console.log('Response Data Type:', responseAnalysis.dataType);
    console.log('Response Data as String:', responseAnalysis.dataString);
    console.log('Final URL:', responseAnalysis.url);
    console.log('=== END ANALYSIS ===');

    return res.status(200).json({
      success: true,
      message: 'Contact submitted to Go High Level successfully!',
      ghlResponse: formResponse.status,
      ghlData: formResponse.data,
      contactData: contactData,
      responseAnalysis: responseAnalysis
    });

  } catch (error) {
    console.error('GHL submission error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      return res.status(500).json({
        error: 'Failed to submit to Go High Level',
        details: error.response?.data || error.message,
        status: error.response?.status,
        url: error.config?.url
      });
    }

    return res.status(500).json({
      error: 'Failed to process contact submission',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
}