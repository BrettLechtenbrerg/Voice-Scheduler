import React, { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Fade,
  Grow,
  Chip,
  Stack,
  TextField,
} from '@mui/material';
import {
  Mic,
  Stop,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Edit as EditIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface ContactData {
  name: string;
  phone: string;
  email: string;
  company?: string;
  notes?: string;
}

interface EditableContactData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
}

interface TranscriptionResponse {
  transcription: string;
  contactData: ContactData;
  success: boolean;
}

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [contactData, setContactData] = useState<ContactData | null>(null);
  const [editableData, setEditableData] = useState<EditableContactData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<string>('');
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check supported MIME types
      const mimeTypes = [
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      let selectedMimeType = 'audio/webm';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('Using MIME type:', mimeType);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk received, size:', event.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        console.log('Total chunks:', audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        console.log('Audio blob created, size:', audioBlob.size, 'type:', audioBlob.type);
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred. Please try again.');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
      setRecordingTime(0);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Add visual feedback for mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      
      // Clear timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Add visual feedback for mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50]);
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      console.log('Processing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      if (audioBlob.size === 0) {
        throw new Error('No audio data recorded. Please try again.');
      }
      
      const formData = new FormData();
      // Use the correct file extension based on MIME type
      const extension = audioBlob.type.includes('webm') ? 'webm' : 
                       audioBlob.type.includes('ogg') ? 'ogg' : 
                       audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('audio', audioBlob, `recording.${extension}`);

      console.log('Sending audio to API...');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.details || errorData.error || `Server error: ${response.status}`;
        console.error('API Error:', errorData);
        
        // Check for specific error types
        if (errorMessage.includes('OpenAI API key not configured') || errorMessage.includes('placeholder')) {
          throw new Error('OpenAI API key is not configured. Please add a valid API key to continue.');
        } else if (errorMessage.includes('Authentication required')) {
          throw new Error('Please sign in to use the voice recording feature.');
        }
        
        throw new Error(errorMessage);
      }

      const result: TranscriptionResponse = await response.json();
      
      // Debug logging
      console.log('📝 API Response:', result);
      console.log('📝 Full Transcript:', result.transcription);
      console.log('📝 Extracted Contact Data:', result.contactData);
      
      // Set transcription
      setTranscription(result.transcription || 'No transcription available');
      setContactData(result.contactData);
      
      // Parse the name into first and last name
      const nameParts = result.contactData.name ? result.contactData.name.trim().split(' ') : ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Set the editable data
      setEditableData({
        firstName,
        lastName,
        phone: result.contactData.phone || '',
        email: result.contactData.email || '',
        company: result.contactData.company || '',
      });
      
      // Always show editing form when we have transcription
      if (result.transcription) {
        console.log('Showing edit form with data:', {
          firstName,
          lastName,
          phone: result.contactData.phone,
          email: result.contactData.email,
          company: result.contactData.company
        });
        setIsEditing(true);
      } else {
        setError('No transcription was generated. Please try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process audio. Please try again.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditSubmit = async () => {
    // Combine first and last name
    const fullName = `${editableData.firstName} ${editableData.lastName}`.trim();
    
    // Enhanced validation
    if (!fullName || fullName.length < 2) {
      setError('Please enter a valid name');
      return;
    }
    
    if (!editableData.phone || editableData.phone.length < 10) {
      setError('Please enter a valid phone number (at least 10 digits)');
      return;
    }
    
    // Validate email format if provided
    if (editableData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editableData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Clear any previous errors
    setError('');
    
    // Create contact data from editable fields
    const dataToSubmit: ContactData = {
      name: fullName,
      phone: editableData.phone,
      email: editableData.email,
      company: editableData.company,
    };
    
    await submitContact(dataToSubmit);
    setIsEditing(false);
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Submission failed');
      }

      const result = await response.json();
      
      if (result.success) {
        setSubmissionResult('✅ Contact submitted successfully! They will receive a calendar link shortly.');
      } else {
        setSubmissionResult('⚠️ Contact processed but submission failed. Please check manually.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit contact. Please try again.';
      setSubmissionResult(`❌ ${errorMessage}`);
    }
  };

  const resetForm = () => {
    setTranscription('');
    setContactData(null);
    setEditableData({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      company: '',
    });
    setIsEditing(false);
    setSubmissionResult('');
    setError('');
    setRecordingTime(0);
  };

  const getAlertSeverity = (message: string) => {
    if (message.includes('✅')) return 'success';
    if (message.includes('⚠️')) return 'warning';
    if (message.includes('❌')) return 'error';
    return 'info';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ 
      maxWidth: 800, 
      mx: 'auto',
      px: { xs: 1, sm: 2 },
      pb: { xs: 4, sm: 2 }
    }}>
      {/* Main Recording Card */}
      <Card 
        elevation={2} 
        sx={{ 
          mb: 3,
          borderRadius: { xs: 2, sm: 3 },
          overflow: 'hidden'
        }}
      >
        <CardContent sx={{ 
          p: { xs: 2, sm: 4 },
          pt: { xs: 3, sm: 4 }
        }}>
          <Typography 
            variant="h4" 
            align="center" 
            gutterBottom
            sx={{ 
              mb: 2, 
              fontWeight: 600, 
              color: 'primary.main',
              fontSize: { xs: '1.75rem', sm: '2.125rem' }
            }}
          >
            🎤 Voice Contact Capture
          </Typography>
          
          <Typography 
            variant="body1" 
            align="center" 
            color="text.secondary"
            sx={{ 
              mb: 4,
              fontSize: { xs: '0.875rem', sm: '1rem' },
              px: { xs: 1, sm: 0 }
            }}
          >
            Speak your contact information to automatically create leads and send calendar links
          </Typography>

          {/* Recording Controls */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <AnimatePresence mode="wait">
              {!isRecording && !isProcessing && (
                <motion.div
                  key="start"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    onClick={startRecording}
                    sx={{
                      width: { xs: 200, sm: 'auto' },
                      height: { xs: 80, sm: 60 },
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 2 },
                      fontSize: { xs: '1.25rem', sm: '1.1rem' },
                      fontWeight: 600,
                      borderRadius: { xs: 40, sm: 2 },
                      background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
                      boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      '&:hover': {
                        background: 'linear-gradient(45deg, #388e3c 30%, #4caf50 90%)',
                        transform: 'scale(1.02)',
                        boxShadow: '0 6px 24px rgba(76, 175, 80, 0.4)',
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                      },
                    }}
                  >
                    <Mic sx={{ fontSize: { xs: 32, sm: 24 } }} />
                    <span>Start Recording</span>
                  </Button>
                </motion.div>
              )}

              {isRecording && (
                <motion.div
                  key="stop"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: 'error.main',
                          boxShadow: '0 0 0 4px rgba(244, 67, 54, 0.2)',
                          mb: 1,
                        }}
                      />
                    </motion.div>
                    <Typography variant="h6" color="error.main" sx={{ fontWeight: 600 }}>
                      {formatTime(recordingTime)}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={stopRecording}
                    color="error"
                    sx={{
                      width: { xs: 200, sm: 'auto' },
                      height: { xs: 80, sm: 60 },
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 2 },
                      fontSize: { xs: '1.25rem', sm: '1.1rem' },
                      fontWeight: 600,
                      borderRadius: { xs: 40, sm: 2 },
                      background: 'linear-gradient(45deg, #f44336 30%, #e57373 90%)',
                      boxShadow: '0 4px 20px rgba(244, 67, 54, 0.3)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%': { transform: 'scale(1)', boxShadow: '0 4px 20px rgba(244, 67, 54, 0.3)' },
                        '50%': { transform: 'scale(1.02)', boxShadow: '0 6px 30px rgba(244, 67, 54, 0.5)' },
                        '100%': { transform: 'scale(1)', boxShadow: '0 4px 20px rgba(244, 67, 54, 0.3)' },
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                      },
                    }}
                  >
                    <Stop sx={{ fontSize: { xs: 32, sm: 24 } }} />
                    <span>Stop Recording</span>
                  </Button>
                </motion.div>
              )}

              {isProcessing && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: 2,
                    py: 3
                  }}>
                    <CircularProgress 
                      size={60} 
                      thickness={4}
                      sx={{ 
                        color: 'primary.main',
                        '& .MuiCircularProgress-circle': {
                          strokeLinecap: 'round',
                        }
                      }} 
                    />
                    <Typography 
                      variant="h6" 
                      color="primary"
                      sx={{ 
                        fontSize: { xs: '1.1rem', sm: '1.25rem' },
                        fontWeight: 500
                      }}
                    >
                      Processing audio...
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Alert 
                  severity="error" 
                  icon={<ErrorIcon />}
                  sx={{ mb: 3 }}
                  onClose={() => setError('')}
                >
                  {error}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Transcription Results */}
      <AnimatePresence>
        {transcription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <Card 
              elevation={1} 
              sx={{ 
                mb: 3,
                borderRadius: { xs: 2, sm: 3 },
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    fontSize: { xs: '1.1rem', sm: '1.25rem' }
                  }}
                >
                  <Mic fontSize="small" />
                  Transcription
                </Typography>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    backgroundColor: 'grey.50',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    maxHeight: { xs: 120, sm: 'none' },
                    overflowY: { xs: 'auto', sm: 'visible' },
                  }}
                >
                  <Typography 
                    variant="body1"
                    sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                  >
                    {transcription}
                  </Typography>
                </Box>
                
                {/* Debug Info - Show extracted data */}
                {contactData && (
                  <Box sx={{ mt: 2, p: 1, backgroundColor: 'info.light', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Extracted: Name: "{contactData.name}" | Phone: "{contactData.phone}" | Email: "{contactData.email}" | Company: "{contactData.company}"
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Data Edit Form */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card 
              elevation={1} 
              sx={{ 
                mb: 3,
                borderRadius: { xs: 2, sm: 3 },
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    mb: 3,
                    fontSize: { xs: '1.1rem', sm: '1.25rem' }
                  }}
                >
                  <EditIcon fontSize="small" color="primary" />
                  Review and Edit Contact Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 } }}>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="First Name"
                      value={editableData.firstName}
                      onChange={(e) => setEditableData({ ...editableData, firstName: e.target.value })}
                      variant="outlined"
                      required
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '1rem', sm: '1rem' },
                          padding: { xs: '14px', sm: '16.5px 14px' }
                        }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Last Name"
                      value={editableData.lastName}
                      onChange={(e) => setEditableData({ ...editableData, lastName: e.target.value })}
                      variant="outlined"
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '1rem', sm: '1rem' },
                          padding: { xs: '14px', sm: '16.5px 14px' }
                        }
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      value={editableData.phone}
                      onChange={(e) => setEditableData({ ...editableData, phone: e.target.value })}
                      variant="outlined"
                      required
                      type="tel"
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '1rem', sm: '1rem' },
                          padding: { xs: '14px', sm: '16.5px 14px' }
                        }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      value={editableData.email}
                      onChange={(e) => setEditableData({ ...editableData, email: e.target.value })}
                      variant="outlined"
                      type="email"
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '1rem', sm: '1rem' },
                          padding: { xs: '14px', sm: '16.5px 14px' }
                        }
                      }}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={editableData.company}
                    onChange={(e) => setEditableData({ ...editableData, company: e.target.value })}
                    variant="outlined"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: { xs: '1rem', sm: '1rem' },
                        padding: { xs: '14px', sm: '16.5px 14px' }
                      }
                    }}
                  />
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    justifyContent: { xs: 'stretch', sm: 'flex-end' }, 
                    mt: 3,
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setIsEditing(false);
                        resetForm();
                      }}
                      fullWidth={true}
                      sx={{
                        py: { xs: 1.5, sm: 1 },
                        fontSize: { xs: '1rem', sm: '0.875rem' },
                        minWidth: { xs: 'auto', sm: 100 },
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<SendIcon sx={{ fontSize: { xs: 20, sm: 20 } }} />}
                      onClick={handleEditSubmit}
                      disabled={!editableData.firstName || !editableData.phone}
                      fullWidth={true}
                      sx={{
                        py: { xs: 1.5, sm: 1 },
                        fontSize: { xs: '1rem', sm: '0.875rem' },
                        fontWeight: 600,
                        minWidth: { xs: 'auto', sm: 160 },
                      }}
                    >
                      Submit Contact
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submission Result */}
      <AnimatePresence>
        {submissionResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Alert 
              severity={getAlertSeverity(submissionResult)}
              sx={{ mb: 3 }}
              onClose={() => setSubmissionResult('')}
            >
              {submissionResult}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Button */}
      <AnimatePresence>
        {(transcription || contactData || submissionResult || isEditing) && !isEditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={resetForm}
                sx={{ px: 3 }}
              >
                Start New Recording
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips Card - Collapsible on mobile */}
      <Card 
        elevation={0} 
        sx={{ 
          mt: 4, 
          backgroundColor: 'grey.50',
          borderRadius: { xs: 2, sm: 3 },
          display: { xs: 'none', sm: 'block' }
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography 
            variant="h6" 
            gutterBottom
            sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
          >
            💡 Tips for Best Results
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              • <strong>Name:</strong> Say "My name is John Smith" or "This is Sarah Johnson"
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Phone:</strong> Speak digits clearly "5-5-5-1-2-3-4-5-6-7" or spell out words
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Email:</strong> Say "john at gmail dot com" or spell it out completely
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Company:</strong> Say "I work at ABC Company" or "Company name is XYZ Inc"
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Speak naturally - the system understands multiple phrase patterns
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Review and edit all extracted information before submitting
            </Typography>
          </Stack>
        </CardContent>
      </Card>
      
      {/* Mobile Tips - Compact version */}
      <Box 
        sx={{ 
          display: { xs: 'block', sm: 'none' },
          mt: 3,
          p: 2,
          backgroundColor: 'primary.main',
          borderRadius: 2,
          color: 'white'
        }}
      >
        <Typography variant="body2" align="center">
          💡 Speak clearly: "My name is... My phone is... My email is..."
        </Typography>
      </Box>
    </Box>
  );
}