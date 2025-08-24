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
    
    console.log('=== GHL INTEGRATION DEBUG ===');
    console.log('GHL_WEBHOOK_URL:', ghlWebhookUrl ? 'CONFIGURED' : 'MISSING');
    console.log('Contact Data:', contactData);
    
    if (!ghlWebhookUrl) {
      console.error('ERROR: GHL_WEBHOOK_URL not configured');
      return res.status(500).json({
        error: 'Webhook configuration missing',
        details: 'GHL_WEBHOOK_URL environment variable not configured'
      });
    }
    
    // Prepare webhook data with explicit field mapping for GHL
    const firstName = contactData.name.split(' ')[0] || contactData.name;
    const lastName = contactData.name.split(' ').slice(1).join(' ') || '';
    
    const webhookData = {
      // Use only the flat structure to avoid duplication
      firstName: firstName,
      lastName: lastName,
      email: contactData.email || '',
      phone: contactData.phone,
      companyName: contactData.company || '',
      
      // Enhanced workflow trigger context for automation
      trigger: 'voice_scheduler_webhook',
      source: 'voice_scheduler', 
      type: 'contact_creation',
      eventType: 'new_lead_voice_capture',
      leadSource: 'Voice Scheduler App',
      
      // Calendar/scheduling specific fields
      needsCalendarLink: true,
      requestCalendar: true,
      scheduleRequest: true,
      
      // Notes and additional data
      notes: contactData.notes || '',
      message: contactData.notes || '',
      transcription: contactData.notes || '',
      description: contactData.notes || '',
      
      // Timestamps
      createdAt: new Date().toISOString(),
      timestamp: Math.floor(Date.now() / 1000),
      submittedAt: new Date().toISOString(),
      
      // Metadata for mapping reference
      webhookType: 'contact_submission',
      version: '2.0',
      workflowId: '2c3de284-6770-4e54-a58d-3b1680f06343'
    };

    console.log('Webhook Data to send:', JSON.stringify(webhookData, null, 2));
    console.log('Sending to URL:', ghlWebhookUrl);
    
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