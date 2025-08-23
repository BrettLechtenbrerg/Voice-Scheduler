import { prisma } from './prisma'
import { Session } from 'next-auth'

export interface WorkspaceWithRole {
  id: string
  name: string
  slug: string
  description?: string | null
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  contactCount: number
  createdAt: Date
}

/**
 * Get user's workspaces with their roles
 */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
  const userWorkspaces = await prisma.userWorkspace.findMany({
    where: { userId },
    include: {
      workspace: true
    }
  })

  return userWorkspaces.map(uw => ({
    id: uw.workspace.id,
    name: uw.workspace.name,
    slug: uw.workspace.slug,
    description: uw.workspace.description,
    role: uw.role,
    contactCount: uw.workspace.contactCount,
    createdAt: uw.workspace.createdAt
  }))
}

/**
 * Get user's default workspace (first one they own or are admin of)
 */
export async function getDefaultWorkspace(userId: string): Promise<WorkspaceWithRole | null> {
  const workspaces = await getUserWorkspaces(userId)
  
  // Prefer owned workspaces, then admin, then any workspace
  return workspaces.find(w => w.role === 'OWNER') || 
         workspaces.find(w => w.role === 'ADMIN') ||
         workspaces[0] || null
}

/**
 * Create a new workspace for a user
 */
export async function createWorkspace(userId: string, name: string, description?: string) {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  
  // Ensure unique slug
  let uniqueSlug = slug
  let counter = 1
  while (await prisma.workspace.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slug}-${counter}`
    counter++
  }

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug: uniqueSlug,
      description,
      users: {
        create: {
          userId,
          role: 'OWNER'
        }
      }
    }
  })

  return workspace
}

/**
 * Check if user has access to workspace and return their role
 */
export async function getUserWorkspaceRole(userId: string, workspaceId: string) {
  const userWorkspace = await prisma.userWorkspace.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId }
    }
  })

  return userWorkspace?.role || null
}

/**
 * Ensure user has a workspace (create default if none exists)
 */
export async function ensureUserHasWorkspace(session: Session) {
  if (!session.user?.id) return null

  const workspaces = await getUserWorkspaces(session.user.id)
  
  if (workspaces.length === 0) {
    // Create default workspace
    const workspace = await createWorkspace(
      session.user.id,
      `${session.user.name || 'My'} Workspace`,
      'Default workspace'
    )
    
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      role: 'OWNER' as const,
      contactCount: 0,
      createdAt: workspace.createdAt
    }
  }

  return getDefaultWorkspace(session.user.id)
}

/**
 * Check if user can perform action in workspace
 */
export function canUserPerformAction(
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
  action: 'read' | 'write' | 'admin' | 'delete'
): boolean {
  const permissions = {
    OWNER: ['read', 'write', 'admin', 'delete'],
    ADMIN: ['read', 'write', 'admin'],
    MEMBER: ['read', 'write'],
    VIEWER: ['read']
  }

  return permissions[userRole].includes(action)
}