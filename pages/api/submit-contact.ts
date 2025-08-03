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
    // Note: Replace with your actual GHL webhook URL or form endpoint
    const ghlWebhookUrl = process.env.GHL_WEBHOOK_URL || process.env.GHL_FORM_URL;
    
    if (!ghlWebhookUrl) {
      console.warn('GHL webhook URL not configured, skipping submission');
      return res.status(200).json({
        success: true,
        message: 'Contact data processed (GHL webhook not configured)',
        contactData: ghlData
      });
    }

    // Method 1: Direct webhook submission
    if (process.env.GHL_WEBHOOK_URL) {
      const webhookResponse = await axios.post(ghlWebhookUrl, ghlData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return res.status(200).json({
        success: true,
        message: 'Contact submitted to GHL webhook',
        ghlResponse: webhookResponse.status,
        contactData: ghlData
      });
    }

    // Method 2: GHL API submission (if using API instead of webhook)
    if (process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID) {
      const apiResponse = await axios.post(
        `https://services.leadconnectorhq.com/contacts/`,
        {
          firstName: contactData.name.split(' ')[0],
          lastName: contactData.name.split(' ').slice(1).join(' '),
          phone: contactData.phone,
          email: contactData.email,
          companyName: contactData.company,
          source: 'Voice Scheduler',
          tags: ['voice-lead'],
          customFields: [
            {
              key: 'notes',
              field_value: contactData.notes || 'Voice-captured lead'
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Contact created in GHL via API',
        contactId: apiResponse.data.contact?.id,
        contactData: ghlData
      });
    }

    // Method 3: Form submission (if using a specific form)
    const formResponse = await axios.post(ghlWebhookUrl, ghlData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });

    return res.status(200).json({
      success: true,
      message: 'Contact submitted to GHL form',
      ghlResponse: formResponse.status,
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