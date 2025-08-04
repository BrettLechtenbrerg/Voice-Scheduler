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

    // Submit to Go High Level inbound webhook
    const ghlWebhookUrl = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/boPxhNvcNB6T3F2CLP0M/webhook-trigger/2a1d5581-45b9-4b3d-8e70-5ad305d52b02';
    
    console.log('Submitting to GHL webhook:', ghlWebhookUrl);
    
    // Prepare webhook data with explicit field mapping for GHL
    const webhookData = {
      // Primary contact fields with GHL standard naming
      contact: {
        firstName: contactData.name.split(' ')[0] || contactData.name,
        lastName: contactData.name.split(' ').slice(1).join(' ') || '',
        name: contactData.name,
        email: contactData.email || '',
        phone: contactData.phone,
        companyName: contactData.company || '',
        source: 'voice_scheduler',
        customFields: {
          notes: contactData.notes || '',
          transcription: contactData.notes || '',
          created_via: 'Voice Scheduler App'
        }
      },
      
      // Alternative flat structure (GHL sometimes prefers this)
      firstName: contactData.name.split(' ')[0] || contactData.name,
      lastName: contactData.name.split(' ').slice(1).join(' ') || '',
      name: contactData.name,
      email: contactData.email || '',
      phone: contactData.phone,
      companyName: contactData.company || '',
      company: contactData.company || '',
      
      // Workflow trigger context
      trigger: 'voice_scheduler_webhook',
      source: 'voice_scheduler',
      type: 'contact_creation',
      
      // Notes and additional data
      notes: contactData.notes || '',
      message: contactData.notes || '',
      transcription: contactData.notes || '',
      
      // Timestamps
      createdAt: new Date().toISOString(),
      timestamp: Math.floor(Date.now() / 1000),
      
      // Metadata for mapping reference
      webhookType: 'contact_submission',
      version: '1.0'
    };
    
    console.log('Submitting webhook data:', webhookData);

    // Submit to GHL inbound webhook (webhooks typically expect JSON)
    const webhookResponse = await axios.post(ghlWebhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Voice-Scheduler/1.0'
      },
      timeout: 15000,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    console.log('GHL Webhook response:', webhookResponse.status, webhookResponse.data);
    console.log('GHL Webhook Response headers:', webhookResponse.headers);

    // Detailed analysis of the response
    const responseAnalysis = {
      status: webhookResponse.status,
      statusText: webhookResponse.statusText,
      headers: webhookResponse.headers,
      data: webhookResponse.data,
      dataType: typeof webhookResponse.data,
      dataString: JSON.stringify(webhookResponse.data),
      url: webhookResponse.config?.url
    };
    
    console.log('=== DETAILED GHL WEBHOOK RESPONSE ANALYSIS ===');
    console.log('Status:', responseAnalysis.status, responseAnalysis.statusText);
    console.log('Response Headers:', responseAnalysis.headers);
    console.log('Response Data:', responseAnalysis.data);
    console.log('Response Data Type:', responseAnalysis.dataType);
    console.log('Response Data as String:', responseAnalysis.dataString);
    console.log('Final URL:', responseAnalysis.url);
    console.log('=== END ANALYSIS ===');

    return res.status(200).json({
      success: true,
      message: 'Contact submitted to Go High Level webhook successfully!',
      ghlResponse: webhookResponse.status,
      ghlData: webhookResponse.data,
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