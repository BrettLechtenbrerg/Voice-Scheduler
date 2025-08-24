import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { prisma } from '../../lib/prisma'
import { ensureUserHasWorkspace } from '../../lib/workspace'
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

function validateContactData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required');
  } else if (data.name.length > 100) {
    errors.push('Name must be less than 100 characters');
  }
  
  if (!data.phone || typeof data.phone !== 'string' || data.phone.trim().length === 0) {
    errors.push('Phone is required');
  } else if (!/^\+?[\d\s\-\(\)]{10,15}$/.test(data.phone)) {
    errors.push('Phone format is invalid');
  }
  
  // Optional email validation
  if (data.email && typeof data.email === 'string' && data.email.length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Email format is invalid');
    }
  }
  
  // Optional company validation
  if (data.company && typeof data.company === 'string' && data.company.length > 200) {
    errors.push('Company name must be less than 200 characters');
  }
  
  // Optional notes validation
  if (data.notes && typeof data.notes === 'string' && data.notes.length > 1000) {
    errors.push('Notes must be less than 1000 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function sanitizeContactData(data: ContactSubmission): ContactSubmission {
  // Clean phone number for GHL SMS compatibility
  let cleanPhone = data.phone.replace(/[^\d\+\-\(\)\s]/g, '').trim();
  
  // Convert to GHL-friendly format (remove + and ensure country code)
  if (cleanPhone.startsWith('+1')) {
    cleanPhone = cleanPhone.replace('+1', '1');
  } else if (cleanPhone.startsWith('+')) {
    cleanPhone = cleanPhone.replace('+', '');
  } else if (cleanPhone.length === 10) {
    cleanPhone = '1' + cleanPhone; // Add US country code if missing
  }
  
  return {
    name: data.name.trim().slice(0, 100),
    phone: cleanPhone,
    email: data.email ? data.email.trim().toLowerCase().slice(0, 100) : '',
    company: data.company ? data.company.trim().slice(0, 200) : '',
    notes: data.notes ? data.notes.trim().slice(0, 1000) : ''
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const rawContactData = req.body;
    
    // Validate incoming data
    const validation = validateContactData(rawContactData);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid contact data',
        details: validation.errors
      });
    }
    
    // Sanitize the data
    const contactData = sanitizeContactData(rawContactData as ContactSubmission);
    
    // Get user's workspace (with error handling)
    let workspace;
    try {
      workspace = await ensureUserHasWorkspace(session);
      if (!workspace) {
        console.log('No workspace found for user:', session.user.email);
        // Continue without workspace for now
      }
    } catch (wsError) {
      console.error('Workspace error:', wsError);
      // Continue without workspace for now
    }
    
    // Submit to Go High Level inbound webhook
    const ghlWebhookUrl = process.env.GHL_WEBHOOK_URL;
    
    // Prepare webhook data - clean and focused approach  
    const firstName = contactData.name.split(' ')[0] || contactData.name;
    const lastName = contactData.name.split(' ').slice(1).join(' ') || '';
    const cleanEmail = contactData.email && contactData.email.trim() ? contactData.email.trim() : '';
    
    console.log('=== GHL INTEGRATION DEBUG ===');
    console.log('GHL_WEBHOOK_URL:', ghlWebhookUrl ? 'CONFIGURED' : 'MISSING');
    console.log('Contact Data:', contactData);
    console.log('Email field specifically:', JSON.stringify(contactData.email));
    console.log('Email field type:', typeof contactData.email);
    console.log('Email field length:', contactData.email ? contactData.email.length : 'null/undefined');
    console.log('Clean email after processing:', JSON.stringify(cleanEmail));
    
    if (!ghlWebhookUrl) {
      console.error('ERROR: GHL_WEBHOOK_URL not configured');
      return res.status(500).json({
        error: 'Webhook configuration missing',
        details: 'GHL_WEBHOOK_URL environment variable not configured'
      });
    }
    
    // Primary webhook payload - GHL-optimized field mapping
    const webhookData: any = {
      first_name: firstName,
      last_name: lastName,
      phone: contactData.phone,
      source: 'Voice Scheduler App',
      timestamp: new Date().toISOString()
    };
    
    // Add email with multiple field name attempts (GHL can be picky about field names)
    if (cleanEmail && cleanEmail.length > 0) {
      webhookData.email = cleanEmail;
      webhookData.email_address = cleanEmail;  // Alternative field name
      webhookData.contact_email = cleanEmail;  // Alternative field name
    }
    
    // Only add optional fields if they exist
    if (contactData.company && contactData.company.trim()) {
      webhookData.company = contactData.company.trim();
      webhookData.company_name = contactData.company.trim();
    }
    
    if (contactData.notes && contactData.notes.trim()) {
      webhookData.message = contactData.notes.trim();
      webhookData.notes = contactData.notes.trim();
    }
    
    // If email is present, also try form-data format as backup
    let formData = null;
    if (cleanEmail) {
      const FormData = require('form-data');
      formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('email', cleanEmail);
      formData.append('email_address', cleanEmail);
      formData.append('phone', contactData.phone);
      if (contactData.company) {
        formData.append('company', contactData.company);
        formData.append('company_name', contactData.company);
      }
      if (contactData.notes) {
        formData.append('message', contactData.notes);
        formData.append('notes', contactData.notes);
      }
      formData.append('source', 'Voice Scheduler App');
    }

    console.log('Webhook Data to send:', JSON.stringify(webhookData, null, 2));
    console.log('Sending to URL:', ghlWebhookUrl);
    
    // GHL approach: Try email as query parameter (common GHL pattern)
    let finalWebhookUrl = ghlWebhookUrl;
    if (cleanEmail && cleanEmail.length > 0) {
      const urlParams = new URLSearchParams();
      urlParams.append('email', cleanEmail);
      urlParams.append('Email', cleanEmail); // Capital version too
      urlParams.append('contact_email', cleanEmail);
      finalWebhookUrl = `${ghlWebhookUrl}${ghlWebhookUrl.includes('?') ? '&' : '?'}${urlParams.toString()}`;
    }
    
    console.log('Final webhook URL with email params:', finalWebhookUrl);
    
    let webhookResponse;
    
    // Convert to URL-encoded string - also include capitalized versions
    const urlEncodedData = new URLSearchParams();
    Object.keys(webhookData).forEach(key => {
      if (webhookData[key] !== undefined && webhookData[key] !== '') {
        urlEncodedData.append(key, webhookData[key]);
      }
    });
    
    // Add capitalized email variants
    if (cleanEmail && cleanEmail.length > 0) {
      urlEncodedData.append('Email', cleanEmail);  // Capital E
      urlEncodedData.append('EMAIL', cleanEmail);  // All caps
      urlEncodedData.append('ContactEmail', cleanEmail); // CamelCase
    }
    
    console.log('URL-encoded data to send:', urlEncodedData.toString());
    console.log('Email specifically in URL data:', urlEncodedData.get('email'));
    
    try {
      // Primary attempt: URL-encoded form data with email in URL params (GHL preferred format)
      webhookResponse = await axios.post(finalWebhookUrl, urlEncodedData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Voice-Scheduler/1.0'
        },
        timeout: 15000,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });
      
      console.log('URL-encoded submission successful');
      
    } catch (urlEncodedError) {
      console.log('URL-encoded submission failed, trying JSON format...');
      
      try {
        // Backup attempt: JSON format with email in URL params
        webhookResponse = await axios.post(finalWebhookUrl, webhookData, {
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
        
        console.log('JSON submission successful as backup');
        
      } catch (jsonError) {
        // Re-throw the original URL-encoded error since that's preferred format
        throw urlEncodedError;
      }
    }
    
    console.log('GHL Response Status:', webhookResponse.status);
    console.log('GHL Response Data:', webhookResponse.data);
    console.log('GHL Response Headers:', webhookResponse.headers);


    // Save contact to database only if workspace exists
    let savedContact = null;
    if (workspace) {
      try {
        savedContact = await prisma.contact.create({
          data: {
            workspaceId: workspace.id,
            name: contactData.name,
            phone: contactData.phone,
            email: contactData.email || null,
            company: contactData.company || null,
            notes: contactData.notes || null,
            transcription: contactData.notes || null,
            status: 'PROCESSED'
          }
        });

        // Update workspace contact count
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: { contactCount: { increment: 1 } }
        });

        // Log usage for analytics
        await prisma.usageLog.create({
          data: {
            workspaceId: workspace.id,
            userId: session.user.id,
            action: 'submit_contact',
            metadata: {
              contactId: savedContact.id,
              ghlStatus: webhookResponse.status
            }
          }
        });
      } catch (dbError) {
        console.error('Database save error:', dbError);
        // Continue - GHL submission was successful
      }
    }

    console.log('=== SUBMISSION SUCCESS ===');
    console.log('Contact saved to DB:', savedContact ? 'YES' : 'NO');
    console.log('Final response status:', webhookResponse.status);
    
    return res.status(200).json({
      success: true,
      message: 'Contact submitted successfully!',
      contactId: savedContact?.id || 'ghl-only',
      status: webhookResponse.status
    });

  } catch (error) {
    // Enhanced error logging
    console.error('=== CONTACT SUBMISSION ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (axios.isAxiosError(error)) {
      console.error('=== AXIOS ERROR DETAILS ===');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Response Data:', error.response?.data);
      console.error('Request URL:', error.config?.url);
      console.error('Request Method:', error.config?.method);
      console.error('Request Headers:', error.config?.headers);
      console.error('Request Data:', error.config?.data);
      
      return res.status(500).json({
        error: 'Failed to submit contact to GHL',
        details: 'Webhook submission failed',
        status: error.response?.status || 500,
        ghlError: error.response?.data || error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to process contact submission',
      details: 'Server error occurred',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
}