# Magic Link Authentication Setup

## Quick Setup for Vercel

Add these environment variables in your Vercel dashboard:

### Gmail Setup (Recommended)
```
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-gmail@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=your-gmail@gmail.com
```

**Gmail App Password Setup:**
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password for "Mail"
4. Use that App Password (not your regular password)

### Alternative: Resend (Simpler)
If Gmail is too complex, use Resend.dev:

```bash
npm install resend
```

Then in Vercel environment variables:
```
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=hello@yourdomain.com
```

### Alternative: SendGrid
```
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=your-verified-sender@yourdomain.com
```

## Test the Magic Link
1. Deploy to Vercel
2. Visit your app
3. Enter your email
4. Check your inbox for the magic link
5. Click the link to sign in

## Benefits
- ✅ No Google OAuth configuration needed
- ✅ No database required for authentication
- ✅ Works on Vercel immediately
- ✅ Simple email-based authentication
- ✅ Secure JWT sessions