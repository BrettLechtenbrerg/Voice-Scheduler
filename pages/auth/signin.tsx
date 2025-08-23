import { GetServerSidePropsContext } from 'next'
import { getServerSession } from 'next-auth/next'
import { signIn, getProviders } from 'next-auth/react'
import { authOptions } from '../api/auth/[...nextauth]'
import Head from 'next/head'
import { Box, Container, Typography, Button, Card, CardContent } from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import MicIcon from '@mui/icons-material/Mic'

interface Provider {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
}

interface SignInProps {
  providers: Record<string, Provider>;
}

export default function SignIn({ providers }: SignInProps) {
  return (
    <>
      <Head>
        <title>Sign In - Voice Scheduler</title>
        <meta name="description" content="Sign in to Voice Scheduler" />
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
          <Card elevation={3} sx={{ maxWidth: 400, mx: 'auto' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <MicIcon sx={{ fontSize: 48, color: 'primary.main', mr: 1 }} />
                <Typography
                  variant="h3"
                  component="h1"
                  sx={{ color: 'primary.main', fontWeight: 700 }}
                >
                  Voice Scheduler
                </Typography>
              </Box>
              
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 4 }}
              >
                Sign in to access your voice scheduling dashboard
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                {Object.values(providers).map((provider) => (
                  <Button
                    key={provider.name}
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={provider.name === 'Google' ? <GoogleIcon /> : undefined}
                    onClick={() => signIn(provider.id)}
                    sx={{
                      mb: 2,
                      py: 1.5,
                      fontSize: '1rem',
                      backgroundColor: provider.name === 'Google' ? '#4285f4' : 'primary.main',
                      '&:hover': {
                        backgroundColor: provider.name === 'Google' ? '#3367d6' : 'primary.dark',
                      },
                    }}
                  >
                    Continue with {provider.name}
                  </Button>
                ))}
              </Box>
              
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 3 }}
              >
                Secure authentication powered by NextAuth.js
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </>
  )
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions)
  
  // If the user is already logged in, redirect to home
  if (session) {
    return { redirect: { destination: '/' } }
  }

  const providers = await getProviders()
  
  return {
    props: {
      providers: providers ?? {},
    },
  }
}