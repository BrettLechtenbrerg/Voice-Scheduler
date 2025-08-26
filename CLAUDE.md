# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Voice Scheduler - Production SaaS Application

Voice Scheduler is a sophisticated multi-tenant SaaS application that enables voice-activated contact capture with automatic CRM integration through Go High Level. The system processes voice recordings into structured contact data using AI transcription and intelligent pattern recognition.

## Development Commands

```bash
# Development
npm run dev                # Start development server
npm run build             # Production build (includes Prisma generation)
npm run start             # Start production server
npm run lint              # ESLint code analysis

# Database Operations
npx prisma generate       # Generate Prisma client after schema changes
npx prisma migrate dev    # Run database migrations
npx prisma studio         # Launch database browser interface

# After installation
npm run postinstall      # Generates Prisma client (runs automatically)
```

**Important**: Always run `npm run build` before deployment to ensure Prisma client generation and type checking.

## High-Level Architecture

### Multi-Tenant SaaS Structure
- **Workspace Isolation**: Each user gets a default workspace with complete data segregation
- **Role-Based Permissions**: Owner/Admin/Member/Viewer roles per workspace
- **Contact Segregation**: All contact data is workspace-scoped for security
- **Usage Analytics**: Per-workspace tracking and monitoring

### Core Application Flow
```
Voice Recording → OpenAI Whisper → Contact Extraction → Manual Review → GHL Integration
     ↓                ↓                    ↓              ↓            ↓
  Browser API      Transcription      Pattern Parsing   UI Form    Webhook/API
```

### Database Architecture (Prisma + PostgreSQL)
The system uses a sophisticated multi-tenant design:
- **Users** with NextAuth integration and workspace relationships
- **Workspaces** providing tenant isolation and usage tracking
- **Contacts** with full lifecycle management and processing status
- **Usage Logs** for analytics and performance monitoring

## Key Technical Patterns

### 1. Advanced Voice Processing Pipeline
**Location**: `/pages/api/transcribe.ts`

The voice processing system includes sophisticated pattern recognition:
- **Phone Number Intelligence**: Handles both numeric formats and voice-to-text patterns ("five five five one two three...")
- **Email Pattern Recognition**: Standard formats plus voice patterns ("john at gmail dot com", "brett dot lechtenberg at gmail dot com")
- **Name Extraction**: Multiple pattern matching for various introduction styles
- **Company Detection**: Context-aware extraction with validation to prevent false positives
- **Security Sanitization**: Comprehensive input cleaning while preserving email formats

### 2. Go High Level Integration Strategy
**Location**: `/pages/api/submit-contact.ts`

The GHL integration uses a robust multi-format approach:
- **Primary Method**: URL-encoded form data (GHL's preferred format)
- **Fallback Strategy**: JSON payload with form-data backup
- **Email Field Redundancy**: Sends email in multiple field name variants (`email`, `Email`, `contact_email`, `email_address`)
- **Query Parameter Backup**: Email also sent as URL parameters for maximum compatibility
- **Phone Formatting**: GHL-optimized phone number processing with country code handling

**Critical Pattern**: The system tries multiple submission formats sequentially to handle GHL's varying webhook configurations across different accounts.

### 3. Workspace Management System
**Location**: `/lib/workspace.ts`

Multi-tenant architecture with:
- **Automatic Workspace Creation**: New users get default workspace with unique slug generation
- **Permission Verification**: All operations check user permissions before execution
- **Data Isolation**: Every database query is workspace-scoped for security
- **Usage Tracking**: Contact counts and feature usage per workspace

### 4. Mobile-First Voice UI
**Location**: `/components/VoiceRecorder.tsx`

Advanced voice recording interface:
- **Touch-Optimized Controls**: Large touch targets with haptic feedback
- **Real-Time Visual Feedback**: Recording states with animated indicators
- **Progressive Form Enhancement**: Pre-populated from voice extraction with manual editing
- **Error Recovery**: Comprehensive error handling with user-friendly guidance

## Environment Configuration

### Required Production Variables
```bash
# Authentication
NEXTAUTH_SECRET=<generated-32-char-secret>
NEXTAUTH_URL=<production-domain>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>

# Database
DATABASE_URL=<postgresql-connection-string>

# AI Processing
OPENAI_API_KEY=<openai-api-key>

# CRM Integration
GHL_WEBHOOK_URL=<go-high-level-webhook-url>
```

**Important**: The GHL_WEBHOOK_URL must be from an active GHL workflow with proper field mapping configured.

## Go High Level Integration Requirements

### Webhook Configuration in GHL
1. **Create Workflow**: Set up workflow with "Inbound Webhook" trigger
2. **Field Mapping**: Map incoming fields to contact properties:
   - `first_name` → Contact First Name
   - `last_name` → Contact Last Name
   - `phone` → Contact Phone
   - `email` → Contact Email (critical for email functionality)
   - `company` → Contact Company
3. **Contact Action**: Add "Create/Update Contact" action after webhook trigger
4. **Save Workflow**: Ensure workflow is published and active

### Integration Debugging
The system provides comprehensive logging for GHL integration issues:
- Webhook payload logging with all field variants
- Response status and error details
- Email field specific tracking through the entire pipeline
- URL-encoded vs JSON format attempt logging

**Common Issue**: If contacts are created but email fields are empty, check the GHL workflow field mapping configuration.

## Security & Data Protection

### Input Validation & Sanitization
- **Voice Data**: Audio files validated for MIME type and size limits
- **Contact Extraction**: All extracted data sanitized while preserving email formats
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **XSS Protection**: React escaping plus additional validation

### Multi-Tenant Security
- **Complete Data Isolation**: No cross-workspace data access possible
- **Permission Checking**: Every API call validates user permissions
- **Session Management**: JWT tokens with proper expiration and rotation

## Performance Considerations

### Audio Processing
- **File Size Limits**: 10MB max audio file size
- **Memory Management**: Efficient blob handling with immediate cleanup
- **Error Recovery**: Comprehensive error handling for audio processing failures

### Database Optimization
- **Workspace Scoping**: All queries include workspace filters for performance
- **Contact Indexing**: Proper database indexes for contact lookups
- **Usage Tracking**: Efficient logging without performance impact

## Production Deployment (Vercel)

The application is configured for seamless Vercel deployment:
- **Auto-Deploy**: GitHub integration with main branch
- **Environment Variables**: All secrets configured in Vercel dashboard
- **Database**: Supabase PostgreSQL with connection pooling
- **Domain**: Custom domain with SSL/TLS

**Deployment Process**: Push to main branch triggers automatic deployment with build-time Prisma generation.

## Development Workflow Patterns

### Contact Processing Flow
1. **Voice Recording**: Browser MediaRecorder API captures audio
2. **Transcription**: OpenAI Whisper processes audio to text
3. **Data Extraction**: Pattern matching extracts contact information
4. **Manual Review**: User can edit extracted data before submission
5. **CRM Integration**: Multiple-format submission to Go High Level
6. **Database Storage**: Contact saved to workspace-isolated database

### Error Handling Strategy
The system implements comprehensive error recovery:
- **OpenAI API Failures**: Detailed error messages with billing/quota guidance
- **GHL Integration Issues**: Multiple submission format attempts with detailed logging
- **Audio Processing Errors**: User-friendly error messages with retry options
- **Database Failures**: Graceful degradation with user notification

This architecture supports enterprise-grade voice-activated lead capture with robust multi-tenant isolation and comprehensive third-party integration capabilities.