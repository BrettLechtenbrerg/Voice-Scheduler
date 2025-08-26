import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { NextAuthOptions } from 'next-auth'
import { prisma } from '../../../lib/prisma'

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
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // Enable debug logs
  callbacks: {
    async session({ session, token }) {
      console.log('🔧 Session callback:', { session, token });
      if (session?.user && token) {
        session.user.id = token.sub || '';
        session.user.role = 'USER';
      }
      console.log('✅ Session result:', session);
      return session;
    },
    async signIn({ user, account, profile }) {
      console.log('🔧 SignIn callback:', { user, account, profile });
      const result = !!user.email;
      console.log('✅ SignIn result:', result);
      return result;
    },
    async jwt({ token, user, account }) {
      console.log('🔧 JWT callback:', { token, user, account });
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      console.log('✅ JWT result:', token);
      return token;
    },
  },
  session: {
    strategy: 'database',
  },
  pages: {
    signIn: '/auth/signin',
  },
}

export default NextAuth(authOptions)