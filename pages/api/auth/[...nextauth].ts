import NextAuth from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { NextAuthOptions } from 'next-auth'

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

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_SERVER_PORT ? parseInt(process.env.EMAIL_SERVER_PORT) : 587,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER,
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