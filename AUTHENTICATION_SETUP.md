# Authentication Setup Guide

Voice Scheduler now includes secure authentication using NextAuth.js with Google OAuth.

## Required Setup Steps

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen if needed
6. For Application Type, select "Web application"
7. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Authentication Configuration (Required)
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth Configuration (Required for authentication)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# OpenAI Configuration (Required)
OPENAI_API_KEY=your_openai_api_key_here

# Go High Level Integration (Required for CRM functionality)
GHL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/your_webhook_id
```

### 3. Generate NextAuth Secret

```bash
# Generate a secure random secret
openssl rand -base64 32
```

## Security Features

✅ **Server-side API protection**: All API routes require authentication  
✅ **Secure session management**: JWT-based sessions with NextAuth.js  
✅ **OAuth integration**: Google OAuth for secure login  
✅ **Input validation**: All user inputs are validated and sanitized  
✅ **No client-side API keys**: All sensitive keys stored server-side only  

## User Flow

1. User visits app → Authentication check
2. If not authenticated → Redirected to sign-in page
3. User signs in with Google → OAuth flow
4. Successful authentication → Access to voice recorder
5. All API calls include session verification

## Development

```bash
npm run dev
```

Visit `http://localhost:3000` - you'll be prompted to sign in.

## Production Deployment

1. Configure production OAuth redirect URLs in Google Console
2. Set production environment variables in deployment platform
3. Update `NEXTAUTH_URL` to production domain
4. Deploy normally - authentication will work automatically

## Troubleshooting

- **"Authentication required" errors**: Check Google OAuth setup and env vars
- **Redirect URI mismatch**: Ensure Google Console URLs match your domain
- **Session issues**: Verify `NEXTAUTH_SECRET` is set and consistent