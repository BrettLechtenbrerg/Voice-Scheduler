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
    
    // Try different field formats that GHL forms commonly use
    const ghlDataVariations = [
      // Format 1: Standard fields
      {
        name: contactData.name,
        phone: contactData.phone,
        email: contactData.email || '',
        company: contactData.company || '',
        message: contactData.notes || 'Voice-captured lead from Voice Scheduler'
      },
      // Format 2: First/Last name split
      {
        first_name: contactData.name.split(' ')[0] || contactData.name,
        last_name: contactData.name.split(' ').slice(1).join(' ') || '',
        phone: contactData.phone,
        email: contactData.email || '',
        company: contactData.company || '',
        message: contactData.notes || 'Voice-captured lead from Voice Scheduler'
      },
      // Format 3: Full name field
      {
        full_name: contactData.name,
        phone: contactData.phone,
        email: contactData.email || '',
        company: contactData.company || '',
        notes: contactData.notes || 'Voice-captured lead from Voice Scheduler'
      }
    ];

    let formResponse;
    let lastError;

    // Try each format with both JSON and form-encoded
    for (let i = 0; i < ghlDataVariations.length; i++) {
      // Try JSON first
      try {
        console.log(`Trying GHL format ${i + 1} (JSON):`, ghlDataVariations[i]);
        
        formResponse = await axios.post(ghlFormUrl, ghlDataVariations[i], {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 15000,
        });

        console.log('GHL Form response (JSON):', formResponse.status, formResponse.data);
        break; // Success, exit loop
        
      } catch (jsonError) {
        console.log(`Format ${i + 1} JSON failed:`, jsonError.response?.status, jsonError.response?.data);
        
        // Try form-encoded as fallback
        try {
          console.log(`Trying GHL format ${i + 1} (form-encoded):`, ghlDataVariations[i]);
          
          // Create form-encoded string manually
          const formDataString = Object.entries(ghlDataVariations[i])
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join('&');
          
          console.log('Form data string:', formDataString);
          
          formResponse = await axios.post(ghlFormUrl, formDataString, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            timeout: 15000,
          });

          console.log('GHL Form response (form):', formResponse.status, formResponse.data);
          break; // Success, exit loop
          
        } catch (formError) {
          console.log(`Format ${i + 1} form failed:`, formError.response?.status, formError.response?.data);
          lastError = formError;
          
          // If this was the last format, throw the error
          if (i === ghlDataVariations.length - 1) {
            throw formError;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Contact submitted to Go High Level successfully!',
      ghlResponse: formResponse.status,
      ghlData: formResponse.data,
      contactData: ghlData
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