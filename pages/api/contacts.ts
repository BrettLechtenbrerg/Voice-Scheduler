import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { prisma } from '../../lib/prisma'
import { ensureUserHasWorkspace, getUserWorkspaceRole, canUserPerformAction } from '../../lib/workspace'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Get user's workspace
  const workspace = await ensureUserHasWorkspace(session);
  if (!workspace) {
    return res.status(500).json({
      error: 'Workspace not found',
      details: 'Unable to determine user workspace'
    });
  }

  // Check user permissions
  const userRole = await getUserWorkspaceRole(session.user.id, workspace.id);
  if (!userRole || !canUserPerformAction(userRole, 'read')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  if (req.method === 'GET') {
    try {
      const { page = '1', limit = '20', search = '' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build search filter
      const searchFilter = search
        ? {
            OR: [
              { name: { contains: search as string, mode: 'insensitive' as const } },
              { email: { contains: search as string, mode: 'insensitive' as const } },
              { phone: { contains: search as string, mode: 'insensitive' as const } },
              { company: { contains: search as string, mode: 'insensitive' as const } },
            ],
          }
        : {};

      // Get contacts with pagination
      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where: {
            workspaceId: workspace.id,
            ...searchFilter,
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum,
        }),
        prisma.contact.count({
          where: {
            workspaceId: workspace.id,
            ...searchFilter,
          },
        }),
      ]);

      return res.status(200).json({
        contacts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Contacts fetch error:', error);
      return res.status(500).json({
        error: 'Failed to fetch contacts',
        details: 'Database error occurred'
      });
    }
  }

  if (req.method === 'DELETE') {
    // Check delete permissions
    if (!canUserPerformAction(userRole!, 'delete')) {
      return res.status(403).json({ error: 'Insufficient permissions for deletion' });
    }

    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Contact ID required' });
      }

      // Verify contact belongs to user's workspace
      const contact = await prisma.contact.findFirst({
        where: {
          id: id as string,
          workspaceId: workspace.id,
        },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Delete contact
      await prisma.contact.delete({
        where: { id: id as string },
      });

      // Update workspace contact count
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { contactCount: { decrement: 1 } }
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Contact deletion error:', error);
      return res.status(500).json({
        error: 'Failed to delete contact',
        details: 'Database error occurred'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}