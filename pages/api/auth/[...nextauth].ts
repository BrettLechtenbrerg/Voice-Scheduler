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
  callbacks: {
    async session({ session, token, user }) {
      if (session?.user) {
        // When using database sessions
        if (user) {
          session.user.id = user.id;
          session.user.role = 'USER';
        }
        // When using JWT sessions
        else if (token) {
          session.user.id = token.sub || '';
          session.user.role = 'USER';
        }
      }
      return session;
    },
    async signIn({ user }) {
      // Simply allow sign in if user has email
      // Workspace creation will happen on first contact submission
      return !!user.email;
    },
    async jwt({ token, user }) {
      // Persist the user ID to the token
      if (user) {
        token.sub = user.id;
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