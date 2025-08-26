import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { NextAuthOptions } from 'next-auth'
import { prisma } from '../../../lib/prisma'
import { ensureUserHasWorkspace } from '../../../lib/workspace'

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
    }),
  ],
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
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }
      
      try {
        // Ensure user has a workspace after sign in
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email }
        });
        
        if (dbUser) {
          await ensureUserHasWorkspace({ user: dbUser } as any);
        }
      } catch (error) {
        console.error('Error ensuring workspace on sign in:', error);
      }
      
      return true;
    },
    async jwt({ token, user, account }) {
      // Persist the user ID to the token
      if (user) {
        token.sub = user.id;
      }
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