# 📱 Mobile Shortcut Setup Guide

## iOS Shortcuts Setup

### Method 1: Voice Recording Shortcut

1. **Open Shortcuts App**
   - Find the Shortcuts app on your iPhone/iPad
   - Tap to open

2. **Create New Shortcut**
   - Tap the "+" icon to create a new shortcut
   - Name it "Voice Scheduler" or "Lead Capture"

3. **Add Actions in Order:**

   **Step 1: Record Audio**
   - Search for "Record Audio" action
   - Set recording quality to "Normal" or "High"
   - Enable "Start Recording Immediately"

   **Step 2: Upload to API**
   - Search for "Get Contents of URL" action
   - Configure as follows:
     - URL: `https://your-vercel-app.vercel.app/api/transcribe`
     - Method: `POST`
     - Headers: `Content-Type: multipart/form-data`
     - Request Body: Choose "Form" and add field `audio` with the recorded audio

   **Step 3: Process Response**
   - Add "Get Text from Input" action
   - Add "Speak Text" action to announce results

4. **Configure Shortcut Settings**
   - Add to Home Screen for quick access
   - Enable Siri phrase: "Capture lead" or "Voice scheduler"
   - Allow running without confirmation

### Method 2: Direct Web Interface

1. **Add Web App to Home Screen**
   - Open Safari
   - Navigate to your deployed Vercel URL
   - Tap Share button
   - Select "Add to Home Screen"
   - Name it "Voice Scheduler"

2. **Use PWA Features**
   - The web app works offline for recording
   - Uploads when connection is available
   - Full-screen experience like native app

## Android Setup

### Method 1: HTTP Shortcuts App

1. **Install HTTP Shortcuts**
   - Download from Google Play Store
   - Open the app

2. **Create New Shortcut**
   - Tap "+" to create shortcut
   - Name: "Voice Scheduler"

3. **Configure Request**
   - Method: POST
   - URL: `https://your-vercel-app.vercel.app/api/transcribe`
   - Content Type: multipart/form-data
   - Add file parameter: `audio`

4. **Add Voice Recording**
   - Use "Pre-Request Actions"
   - Add "Record Audio" action
   - Set duration or manual stop

5. **Add to Home Screen**
   - Save shortcut
   - Add widget to home screen

### Method 2: Google Assistant Routine

1. **Open Google Assistant Settings**
   - Say "Hey Google, open Assistant settings"
   - Go to "Routines"

2. **Create New Routine**
   - Tap "+" to add routine
   - Name: "Capture Lead"

3. **Set Trigger**
   - Voice command: "Capture lead" or "Voice scheduler"
   - Or specific phrase

4. **Add Actions**
   - "Record voice memo"
   - "Send to webhook" (using IFTTT or Zapier integration)

### Method 3: Tasker (Advanced)

1. **Install Tasker**
   - Purchase and install Tasker
   - Grant necessary permissions

2. **Create Task**
   - New Task: "Voice Scheduler"
   - Actions:
     - Record Audio
     - HTTP POST to your API
     - Parse response
     - Show notification with results

3. **Create Profile**
   - Trigger: Voice command or gesture
   - Link to Voice Scheduler task

## Integration Examples

### Siri Integration (iOS)

```
"Hey Siri, capture lead"
→ Records audio
→ Processes with Whisper
→ Submits to GHL
→ Announces "Lead captured for [Name]"
```

### Google Assistant Integration (Android)

```
"Hey Google, voice scheduler"
→ "Recording now, speak your lead info"
→ Processes and submits
→ "Contact [Name] has been added"
```

## Usage Tips

### For Best Voice Recognition:
- Speak clearly and at normal pace
- Use structured phrases:
  - "My name is John Smith"
  - "Phone number 555-123-4567"
  - "Email john@company.com"
  - "I work at ABC Company"

### Recording Environment:
- Find quiet space when possible
- Hold phone 6-8 inches from mouth
- Speak directly toward microphone
- Avoid background noise/music

### Troubleshooting:
- Check internet connection
- Verify API endpoint URL
- Test web interface first
- Check microphone permissions

## Advanced Features

### Offline Mode Setup
- Enable offline recording
- Queue uploads for later
- Background sync when connected

### Custom Voice Commands
- Train Siri/Google with specific phrases
- Set up multiple trigger words
- Context-aware commands

### Integration with CRM Workflows
- Automatic follow-up triggers
- Lead scoring based on voice data
- Custom field mapping

## Security Considerations

- Audio data is processed and not stored permanently
- Use HTTPS endpoints only
- Consider VPN for sensitive business data
- Regular security updates for mobile apps

## Quick Start Commands

**iOS Shortcut URL Scheme:**
```
shortcuts://create-shortcut?name=Voice%20Scheduler&actions=[record-audio,http-post]
```

**Android Intent:**
```
intent://voice-scheduler#Intent;scheme=https;package=ch.rmy.android.http_shortcuts;end
```

Ready to capture leads hands-free! 🎯