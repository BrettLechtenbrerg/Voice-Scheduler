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
        const errorData = await response.json();
        throw new Error(errorData.details || `Server error: ${response.status}`);
      }

      const result: TranscriptionResponse = await response.json();
      setTranscription(result.transcription);
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
      
      // Show editing form instead of auto-submitting
      if (result.contactData.name || result.contactData.phone) {
        setIsEditing(true);
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
    
    // Validate required fields
    if (!fullName || !editableData.phone) {
      setError('Name and phone number are required');
      return;
    }
    
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
  };

  const getAlertSeverity = (message: string) => {
    if (message.includes('✅')) return 'success';
    if (message.includes('⚠️')) return 'warning';
    if (message.includes('❌')) return 'error';
    return 'info';
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Main Recording Card */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography 
            variant="h4" 
            align="center" 
            gutterBottom
            sx={{ mb: 3, fontWeight: 600, color: 'primary.main' }}
          >
            Voice Contact Capture
          </Typography>
          
          <Typography 
            variant="body1" 
            align="center" 
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Speak your contact information to automatically create leads and send calendar links
          </Typography>

          {/* Recording Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <AnimatePresence mode="wait">
              {!isRecording && !isProcessing && (
                <motion.div
                  key="start"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Mic />}
                    onClick={startRecording}
                    sx={{
                      px: 4,
                      py: 2,
                      fontSize: '1.1rem',
                      background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #388e3c 30%, #4caf50 90%)',
                      },
                    }}
                  >
                    Start Recording
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
                >
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Stop />}
                    onClick={stopRecording}
                    color="error"
                    sx={{
                      px: 4,
                      py: 2,
                      fontSize: '1.1rem',
                      background: 'linear-gradient(45deg, #f44336 30%, #e57373 90%)',
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.05)' },
                        '100%': { transform: 'scale(1)' },
                      },
                    }}
                  >
                    Stop Recording
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CircularProgress size={24} />
                    <Typography variant="h6" color="primary">
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
            <Card elevation={1} sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Mic fontSize="small" />
                  Transcription
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: 'grey.50',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Typography variant="body1">{transcription}</Typography>
                </Box>
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
            <Card elevation={1} sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <EditIcon fontSize="small" color="primary" />
                  Review and Edit Contact Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="First Name"
                      value={editableData.firstName}
                      onChange={(e) => setEditableData({ ...editableData, firstName: e.target.value })}
                      variant="outlined"
                      required
                    />
                    <TextField
                      fullWidth
                      label="Last Name"
                      value={editableData.lastName}
                      onChange={(e) => setEditableData({ ...editableData, lastName: e.target.value })}
                      variant="outlined"
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
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      value={editableData.email}
                      onChange={(e) => setEditableData({ ...editableData, email: e.target.value })}
                      variant="outlined"
                      type="email"
                    />
                  </Box>
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={editableData.company}
                    onChange={(e) => setEditableData({ ...editableData, company: e.target.value })}
                    variant="outlined"
                  />
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setIsEditing(false);
                          resetForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SendIcon />}
                        onClick={handleEditSubmit}
                        disabled={!editableData.firstName || !editableData.phone}
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

      {/* Tips Card */}
      <Card elevation={0} sx={{ mt: 4, backgroundColor: 'grey.50' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💡 Tips for Best Results
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              • Speak clearly and at a normal pace
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Include "My name is..." or "This is..."
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Say phone numbers digit by digit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Spell out email addresses if needed
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Mention company name if applicable
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • You can review and edit all information before submitting
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}