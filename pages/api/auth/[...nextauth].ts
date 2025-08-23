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
    async session({ session, user }) {
      if (session?.user && user) {
        session.user.id = user.id;
        
        // Get user from database with role
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id }
        });
        
        if (dbUser) {
          session.user.role = dbUser.role;
          
          // Ensure user has a workspace and get the default one
          const workspace = await ensureUserHasWorkspace(session);
          if (workspace) {
            session.user.currentWorkspaceId = workspace.id;
          }
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Ensure user exists in database
      if (account?.provider === 'google' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email }
        });

        if (!existingUser) {
          // User will be created by PrismaAdapter
          return true;
        }
      }
      return true;
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