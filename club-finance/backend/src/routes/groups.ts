import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireGroupMember, requireTreasurer } from '../middleware/group';

const router = Router();

router.use(authenticate);

// Create a new group; creator becomes OWNER
const createGroupSchema = z.object({
  name: z.string().min(1),
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      members: {
        create: { userId: req.userId!, role: 'OWNER' },
      },
    },
    include: { members: true },
  });

  res.status(201).json({ group });
});

// List groups the current user belongs to
router.get('/', async (req: AuthRequest, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId },
    include: { group: true },
  });

  res.json({ groups: memberships.map((m) => ({ ...m.group, role: m.role })) });
});

// Get a single group with members
router.get('/:groupId', requireGroupMember, async (req, res) => {
  const group = await prisma.group.findUnique({
    where: { id: req.params.groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json({ group });
});

// Join a group directly by ID (simple invite-by-link flow)
router.post('/:groupId/join', async (req: AuthRequest, res) => {
  const groupId = req.params.groupId;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId } },
  });
  if (existing) return res.status(409).json({ error: 'Already a member' });

  const membership = await prisma.groupMember.create({
    data: { userId: req.userId!, groupId, role: 'MEMBER' },
  });

  res.status(201).json({ membership });
});

// Invite a member by email (must already have an account)
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['TREASURER', 'MEMBER']).optional(),
});

router.post('/:groupId/invite', requireGroupMember, requireTreasurer, async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(404).json({ error: 'No user with that email' });

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: req.params.groupId } },
  });
  if (existing) return res.status(409).json({ error: 'User is already a member' });

  const membership = await prisma.groupMember.create({
    data: {
      userId: user.id,
      groupId: req.params.groupId,
      role: parsed.data.role || 'MEMBER',
    },
  });

  res.status(201).json({ membership });
});

// Update a member's role
const updateRoleSchema = z.object({
  role: z.enum(['OWNER', 'TREASURER', 'MEMBER']),
});

router.patch(
  '/:groupId/members/:memberId',
  requireGroupMember,
  requireTreasurer,
  async (req, res) => {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const member = await prisma.groupMember.update({
      where: { id: req.params.memberId },
      data: { role: parsed.data.role },
    });

    res.json({ member });
  }
);

// Remove a member
router.delete('/:groupId/members/:memberId', requireGroupMember, requireTreasurer, async (req, res) => {
  await prisma.groupMember.delete({ where: { id: req.params.memberId } });
  res.status(204).send();
});

export default router;
