import React from 'react';
import { useSession, signIn } from 'next-auth/react'
import Head from 'next/head';
import { Box, Typography, Button, CircularProgress, Container } from '@mui/material';
import Layout from '../components/Layout';
import VoiceRecorder from '../components/VoiceRecorder';
import LoginIcon from '@mui/icons-material/Login';

export default function Home() {
  const { status } = useSession();


  // Show loading state
  if (status === 'loading') {
    return (
      <>
        <Head>
          <title>Loading - Voice Scheduler</title>
        </Head>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.default'
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Loading...
            </Typography>
          </Box>
        </Box>
      </>
    )
  }

  // Show sign in if not authenticated
  if (status === 'unauthenticated') {
    return (
      <>
        <Head>
          <title>Voice Scheduler - Sign In Required</title>
          <meta name="description" content="Voice-activated contact entry and appointment scheduling" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.default',
          }}
        >
          <Container maxWidth="sm">
            <Box
              sx={{
                backgroundColor: 'background.paper',
                borderRadius: 3,
                p: 4,
                textAlign: 'center',
                boxShadow: 3,
              }}
            >
              <Typography
                variant="h3"
                component="h1"
                gutterBottom
                sx={{ color: 'primary.main', fontWeight: 700 }}
              >
                🎤 Voice Scheduler
              </Typography>
              
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 4 }}
              >
                Please sign in to access the voice scheduling system
              </Typography>
              
              <Button
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                onClick={() => signIn()}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                }}
              >
                Sign In
              </Button>
            </Box>
          </Container>
        </Box>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Voice Scheduler</title>
        <meta name="description" content="Voice-activated contact entry and appointment scheduling" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        <VoiceRecorder />
      </Layout>
    </>
  );
}