# Production Setup - Voice Scheduler

## Stable URLs
- **Production App**: https://voice-scheduler-green.vercel.app
- **Team Testing**: Share the production URL above

## Google OAuth Configuration
### Redirect URIs (in Google Cloud Console)
- Production: `https://voice-scheduler-green.vercel.app/api/auth/callback/google`  
- Development: `http://localhost:3000/api/auth/callback/google`

### Credentials
- Client ID: `645100031392-taos66h2gspqefuhtvbp7mid0qerr4n3.apps.googleusercontent.com`
- Client Secret: Stored securely in Vercel environment variables

## Environment Variables (Vercel Production)
```
NEXTAUTH_SECRET=VEj4SVTAywJO+vuR5D4C+cg2mBwJ3VjvX6MgQt8kIwk=
NEXTAUTH_URL=https://voice-scheduler-green.vercel.app
GOOGLE_CLIENT_ID=645100031392-taos66h2gspqefuhtvbp7mid0qerr4n3.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[encrypted in Vercel]
DATABASE_URL=[Supabase PostgreSQL URL]
OPENAI_API_KEY=[encrypted in Vercel]
```

## Authentication Strategy
- **Session Strategy**: JWT (reliable, no database dependency for auth)
- **Provider**: Google OAuth 2.0
- **Database**: Supabase PostgreSQL for app data

## Deployment
- **Platform**: Vercel
- **Auto-deploy**: Connected to GitHub main branch
- **Build Command**: `npm run build`
- **Framework**: Next.js 14

## For Team Testing
1. Visit: https://voice-scheduler-green.vercel.app
2. Click "Continue with Google"
3. Sign in with your Google account
4. Access the Voice Scheduler interface

## Maintenance
- Google OAuth credentials are stable (no need to change)
- Vercel environment variables are set and encrypted
- App auto-deploys on git push to main branch
- No manual intervention required for normal operation