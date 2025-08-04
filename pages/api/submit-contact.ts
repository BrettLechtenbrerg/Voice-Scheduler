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
    
    // GHL Voice Scheduler form expects these exact field names:
    // first_name, last_name, phone, email, full_name (for company)
    const ghlData = {
      first_name: contactData.name.split(' ')[0] || contactData.name,
      last_name: contactData.name.split(' ').slice(1).join(' ') || '',
      phone: contactData.phone,
      email: contactData.email || '',
      full_name: contactData.company || '', // This field is actually "Company Name" in the form
    };
    
    console.log('Submitting exact GHL form data:', ghlData);

    let formResponse;
    
    // Try form-encoded submission (most common for GHL forms)
    try {
      const formDataString = Object.entries(ghlData)
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

      console.log('GHL Form response:', formResponse.status, formResponse.data);
      
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
    }

    return res.status(200).json({
      success: true,
      message: 'Contact submitted to Go High Level successfully!',
      ghlResponse: formResponse.status,
      ghlData: formResponse.data,
      contactData: contactData
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