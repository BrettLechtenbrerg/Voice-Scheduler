# Resend Setup Guide for Voice Scheduler

## Step 1: Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free)
3. Verify your email address

## Step 2: Get Your API Key
1. After signing in, go to the API Keys section
2. Click "Create API Key"
3. Name it "Voice Scheduler"
4. Copy the API key (starts with `re_`)

## Step 3: Add to Vercel Environment Variables
Go to your Vercel project settings and add:

```
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@voice-scheduler.app
```

**Note:** You can use any "from" email address with Resend's free plan.

## Step 4: Test Locally (Optional)
Add to your `.env.local` file:
```
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@voice-scheduler.app
NEXTAUTH_SECRET=xMbT5YVzqnBjKxHdXPizgcmQn7l+buOk2o0ljBcbK8U=
NEXTAUTH_URL=http://localhost:3000
```

## Step 5: Deploy and Test
1. Deploy the changes to Vercel
2. Visit your app: https://voice-scheduler-green.vercel.app
3. Enter your email address
4. Check your inbox for a beautifully styled magic link email
5. Click the link to sign in instantly!

## Benefits of Resend
✅ No SMTP configuration needed
✅ Beautiful HTML emails
✅ Reliable delivery
✅ Free tier: 100 emails/day
✅ No domain verification required
✅ Works immediately on Vercel