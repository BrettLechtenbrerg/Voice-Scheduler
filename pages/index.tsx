import { useState, useRef } from 'react';
import Head from 'next/head';

interface ContactData {
  name: string;
  phone: string;
  email: string;
  company?: string;
  notes?: string;
}

interface TranscriptionResponse {
  transcription: string;
  contactData: ContactData;
  success: boolean;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [contactData, setContactData] = useState<ContactData | null>(null);
  const [submissionResult, setSubmissionResult] = useState<string>('');
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: TranscriptionResponse = await response.json();
      setTranscription(result.transcription);
      setContactData(result.contactData);
      
      // Auto-submit if we have required data
      if (result.contactData.name && result.contactData.phone) {
        await submitContact(result.contactData);
      }
    } catch (err) {
      setError('Failed to process audio. Please try again.');
      console.error('Audio processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitContact = async (data: ContactData) => {
    try {
      const response = await fetch('/api/submit-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (result.success) {
        setSubmissionResult('✅ Contact submitted successfully! They will receive a calendar link shortly.');
      } else {
        setSubmissionResult('⚠️ Contact processed but submission failed. Please check manually.');
      }
    } catch (err) {
      setSubmissionResult('❌ Failed to submit contact. Please try again.');
      console.error('Submission error:', err);
    }
  };

  const resetForm = () => {
    setTranscription('');
    setContactData(null);
    setSubmissionResult('');
    setError('');
  };

  return (
    <>
      <Head>
        <title>Voice Scheduler</title>
        <meta name="description" content="Voice-activated contact entry and appointment scheduling" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ 
        minHeight: '100vh', 
        padding: '2rem', 
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ 
          maxWidth: '600px', 
          margin: '0 auto', 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            textAlign: 'center', 
            marginBottom: '2rem',
            color: '#333'
          }}>
            🎤 Voice Scheduler
          </h1>
          
          <p style={{ 
            textAlign: 'center', 
            marginBottom: '2rem',
            color: '#666'
          }}>
            Speak your contact information to automatically create leads and send calendar links
          </p>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            {!isRecording && !isProcessing && (
              <button
                onClick={startRecording}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(76,175,80,0.3)'
                }}
              >
                🎙️ Start Recording
              </button>
            )}

            {isRecording && (
              <button
                onClick={stopRecording}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(244,67,54,0.3)',
                  animation: 'pulse 1.5s infinite'
                }}
              >
                ⏹️ Stop Recording
              </button>
            )}

            {isProcessing && (
              <div style={{ color: '#2196F3', fontSize: '1.1rem' }}>
                🔄 Processing audio...
              </div>
            )}
          </div>

          {error && (
            <div style={{
              backgroundColor: '#ffebee',
              color: '#c62828',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {transcription && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#333' }}>Transcription:</h3>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                {transcription}
              </div>
            </div>
          )}

          {contactData && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#333' }}>Extracted Contact Info:</h3>
              <div style={{
                backgroundColor: '#e8f5e8',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #c3e6c3'
              }}>
                <p><strong>Name:</strong> {contactData.name || 'Not detected'}</p>
                <p><strong>Phone:</strong> {contactData.phone || 'Not detected'}</p>
                <p><strong>Email:</strong> {contactData.email || 'Not detected'}</p>
                {contactData.company && <p><strong>Company:</strong> {contactData.company}</p>}
                {contactData.notes && <p><strong>Notes:</strong> {contactData.notes}</p>}
              </div>
            </div>
          )}

          {submissionResult && (
            <div style={{
              backgroundColor: submissionResult.includes('✅') ? '#e8f5e8' : 
                             submissionResult.includes('⚠️') ? '#fff3cd' : '#ffebee',
              color: submissionResult.includes('✅') ? '#2e7d32' : 
                     submissionResult.includes('⚠️') ? '#856404' : '#c62828',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              {submissionResult}
            </div>
          )}

          {(transcription || contactData || submissionResult) && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={resetForm}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '25px',
                  padding: '0.5rem 1.5rem',
                  cursor: 'pointer'
                }}
              >
                🔄 Reset
              </button>
            </div>
          )}

          <div style={{
            marginTop: '3rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            <h4>💡 Tips for best results:</h4>
            <ul>
              <li>Speak clearly and at a normal pace</li>
              <li>Include "My name is..." or "This is..."</li>
              <li>Say phone numbers digit by digit</li>
              <li>Spell out email addresses if needed</li>
              <li>Mention company name if applicable</li>
            </ul>
          </div>
        </div>

        <style jsx>{`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}</style>
      </main>
    </>
  );
}