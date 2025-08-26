import NextAuth from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { NextAuthOptions } from 'next-auth'
import { Resend } from 'resend'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
      currentWorkspaceId?: string
    }
  }
}

const resend = new Resend(process.env.RESEND_API_KEY)

console.log('🔧 NextAuth Config - RESEND_API_KEY present:', !!process.env.RESEND_API_KEY)
console.log('🔧 NextAuth Config - EMAIL_FROM:', process.env.EMAIL_FROM)

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: '', // Not needed for Resend
      from: process.env.EMAIL_FROM || 'noreply@voice-scheduler.app',
      sendVerificationRequest: async ({ identifier: email, url, provider }) => {
        try {
          await resend.emails.send({
            from: provider.from as string,
            to: email,
            subject: 'Sign in to Voice Scheduler',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #4285f4; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0; font-size: 24px;">🎤 Voice Scheduler</h1>
                </div>
                <div style="padding: 30px 20px;">
                  <h2 style="color: #333; margin-bottom: 20px;">Sign in to your account</h2>
                  <p style="color: #666; line-height: 1.5; margin-bottom: 30px;">
                    Click the button below to securely sign in to Voice Scheduler. This link will expire in 24 hours.
                  </p>
                  <div style="text-align: center;">
                    <a href="${url}" 
                       style="background: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                      Sign In to Voice Scheduler
                    </a>
                  </div>
                  <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                    If you didn't request this email, you can safely ignore it.
                  </p>
                </div>
              </div>
            `,
            text: `Sign in to Voice Scheduler\n\nClick this link to sign in: ${url}\n\nIf you didn't request this email, you can safely ignore it.`,
          })
          console.log('✅ Magic link email sent successfully to:', email)
        } catch (error) {
          console.error('❌ Failed to send magic link email:', error)
          throw error
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.sub || token.email || '';
        session.user.role = 'USER';
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id || user.email || '';
        token.email = user.email;
        token.name = user.name || user.email || '';
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
}

export default NextAuth(authOptions)