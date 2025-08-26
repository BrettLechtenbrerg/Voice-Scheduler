import { GetServerSidePropsContext } from 'next'
import { getServerSession } from 'next-auth/next'
import { signIn } from 'next-auth/react'
import { authOptions } from '../api/auth/[...nextauth]'
import Head from 'next/head'
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  TextField,
  Alert 
} from '@mui/material'
import { Email } from '@mui/icons-material'
import MicIcon from '@mui/icons-material/Mic'
import { useState } from 'react'

export default function SignIn() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    
    try {
      const result = await signIn('email', { 
        email,
        redirect: false
      })
      
      if (result?.error) {
        setError('Failed to send magic link. Please try again.')
      } else {
        setMessage(`Magic link sent to ${email}! Check your inbox and click the link to sign in.`)
        setEmail('')
      }
    } catch (error) {
      console.error('Sign in error:', error)
      setError('Failed to send magic link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
                Enter your email to receive a secure magic link
              </Typography>

              {message && (
                <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
                  {message}
                </Alert>
              )}
              
              {error && (
                <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSignIn}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  sx={{ mb: 3 }}
                  placeholder="your.email@example.com"
                />
                
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  startIcon={<Email />}
                  disabled={loading || !email}
                  sx={{
                    py: 2,
                    fontSize: '1.1rem',
                    textTransform: 'none',
                  }}
                >
                  {loading ? 'Sending Magic Link...' : 'Send Magic Link'}
                </Button>
              </form>
              
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 3 }}
              >
                We'll send you a secure link to sign in instantly
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
  
  return {
    props: {},
  }
}