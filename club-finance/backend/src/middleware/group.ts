import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../prisma';

/**
 * Ensures the authenticated user is a member of the group specified
 * by req.params.groupId. Attaches the membership to req.membership.
 */
export async function requireGroupMember(req: AuthRequest, res: Response, next: NextFunction) {
  const groupId = req.params.groupId;
  const userId = req.userId!;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });

  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this group' });
  }

  (req as any).membership = membership;
  next();
}

/**
 * Ensures the authenticated user is OWNER or TREASURER of the group.
 * Must be used after requireGroupMember.
 */
export function requireTreasurer(req: AuthRequest, res: Response, next: NextFunction) {
  const membership = (req as any).membership;
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'TREASURER')) {
    return res.status(403).json({ error: 'Requires OWNER or TREASURER role' });
  }
  next();
}
