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
  return {
    name: data.name.trim().slice(0, 100),
    phone: data.phone.replace(/[^\d\+\-\(\)\s]/g, '').trim(),
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
    
    if (!ghlWebhookUrl) {
      return res.status(500).json({
        error: 'Webhook configuration missing',
        details: 'GHL_WEBHOOK_URL environment variable not configured'
      });
    }
    
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

    return res.status(200).json({
      success: true,
      message: 'Contact submitted successfully!',
      contactId: savedContact?.id || 'ghl-only',
      status: webhookResponse.status
    });

  } catch (error) {
    // Log errors for debugging (server-side only)
    if (process.env.NODE_ENV === 'development') {
      console.error('Contact submission error:', error);
    }
    
    if (axios.isAxiosError(error)) {
      return res.status(500).json({
        error: 'Failed to submit contact',
        details: 'Webhook submission failed',
        status: error.response?.status || 500
      });
    }

    return res.status(500).json({
      error: 'Failed to process contact submission',
      details: 'Server error occurred'
    });
  }
}