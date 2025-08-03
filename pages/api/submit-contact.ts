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

    // Validate required fields
    if (!contactData.name || !contactData.phone) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'phone']
      });
    }

    // Prepare GHL form data
    const ghlData: GHLFormSubmission = {
      name: contactData.name,
      phone: contactData.phone,
      email: contactData.email || '',
      company: contactData.company || '',
      message: contactData.notes || 'Voice-captured lead from Voice Scheduler'
    };

    // Submit to Go High Level
    const ghlFormUrl = process.env.GHL_FORM_URL || 'https://api.leadconnectorhq.com/widget/form/fLVbcMPIRtUrfEIPkyGF';
    
    console.log('Submitting to GHL form:', ghlFormUrl);

    // Submit to GHL Form
    const formResponse = await axios.post(ghlFormUrl, ghlData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });

    console.log('GHL Form response:', formResponse.status, formResponse.data);

    return res.status(200).json({
      success: true,
      message: 'Contact submitted to Go High Level successfully!',
      ghlResponse: formResponse.status,
      ghlData: formResponse.data,
      contactData: ghlData
    });

  } catch (error) {
    console.error('GHL submission error:', error);
    
    if (axios.isAxiosError(error)) {
      return res.status(500).json({
        error: 'Failed to submit to Go High Level',
        details: error.response?.data || error.message,
        status: error.response?.status
      });
    }

    return res.status(500).json({
      error: 'Failed to process contact submission',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}