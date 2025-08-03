# 🎤 Voice Scheduler

A voice-activated contact entry and appointment scheduling system that integrates with Go High Level (GHL).

## Features

- 🎙️ Voice recording and transcription using OpenAI Whisper
- 📝 Automatic contact data extraction (name, phone, email, company)
- 🔄 Integration with Go High Level for lead management
- 📱 Mobile-friendly interface for voice capture
- ⚡ Real-time processing and submission
- 📧 Automatic follow-up emails and SMS via GHL workflows

## Quick Start

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/BrettLechtenbrerg/Voice-Scheduler.git
cd Voice-Scheduler

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` with your API keys:

```env
OPENAI_API_KEY=your_openai_api_key_here
GHL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/your_webhook_id
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard:
   - `OPENAI_API_KEY`
   - `GHL_WEBHOOK_URL` (or other GHL configuration)
3. Deploy automatically from main branch

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for Whisper transcription | Yes |
| `GHL_WEBHOOK_URL` | Go High Level webhook URL | Recommended |
| `GHL_FORM_URL` | Alternative: GHL form submission URL | Optional |
| `GHL_API_KEY` | Direct GHL API access | Optional |
| `GHL_LOCATION_ID` | GHL location ID for API | Optional |

## API Endpoints

### POST `/api/transcribe`
- Accepts audio file upload
- Returns transcribed text and extracted contact data
- Uses OpenAI Whisper for speech-to-text

### POST `/api/submit-contact`
- Accepts contact data JSON
- Submits to Go High Level
- Triggers GHL workflows for follow-up

## Mobile Integration

### iOS Shortcut Setup
1. Open Shortcuts app
2. Create new shortcut with these actions:
   - "Get Contents of URL" → POST to `your-domain.vercel.app/api/transcribe`
   - "Get Voice Memo" → Record audio
   - Upload and process response

### Android Integration
- Use HTTP Shortcuts app or Google Assistant routines
- Configure voice recording and API submission

## Go High Level Setup

### Method 1: Webhook (Recommended)
1. Create new workflow in GHL
2. Set trigger to "Webhook"
3. Copy webhook URL to `GHL_WEBHOOK_URL`
4. Configure follow-up actions (SMS, email, calendar link)

### Method 2: Form Submission
1. Create form in GHL
2. Copy form submission URL
3. Set up workflow triggers on form submission

### Method 3: Direct API
1. Generate API key in GHL settings
2. Get your location ID
3. Configure direct contact creation

## Contact Data Processing

The system automatically extracts:
- **Name**: "My name is..." or "This is..." patterns
- **Phone**: Various formats (xxx-xxx-xxxx, (xxx) xxx-xxxx, etc.)
- **Email**: Standard email patterns
- **Company**: "I work at..." or "from..." patterns
- **Notes**: Full transcription for context

## Tips for Best Results

- Speak clearly at normal pace
- Use phrases like "My name is John Smith"
- Say phone numbers digit by digit
- Spell email addresses if complex
- Mention company context explicitly

## Technology Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Next.js API routes
- **Transcription**: OpenAI Whisper API
- **CRM**: Go High Level integration
- **Deployment**: Vercel
- **Version Control**: GitHub

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create GitHub issue
- Check documentation
- Review environment variable configuration