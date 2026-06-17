import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { requireGroupMember } from '../middleware/group';
import { computeBalances, simplifyDebts } from '../utils/balance';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /groups/:groupId/balances - net balance per member
router.get('/balances', requireGroupMember, async (req, res) => {
  const groupId = req.params.groupId;

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { shares: true },
  });

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const balancesMap = computeBalances(
    expenses.map((e) => ({
      amount: Number(e.amount),
      paidById: e.paidById,
      shares: e.shares.map((s) => ({ userId: s.userId, amount: Number(s.amount) })),
    }))
  );

  // Account for already-settled payments
  const settlements = await prisma.settlement.findMany({
    where: { groupId, status: 'PAID' },
  });
  for (const s of settlements) {
    const amt = Number(s.amount);
    balancesMap.set(s.fromId, (balancesMap.get(s.fromId) || 0) + amt);
    balancesMap.set(s.toId, (balancesMap.get(s.toId) || 0) - amt);
  }

  const balances = members.map((m) => ({
    user: m.user,
    balance: Math.round((balancesMap.get(m.userId) || 0) * 100) / 100,
  }));

  res.json({ balances });
});

// GET /groups/:groupId/settlements/suggested - debt simplification
router.get('/settlements/suggested', requireGroupMember, async (req, res) => {
  const groupId = req.params.groupId;

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { shares: true },
  });

  const balancesMap = computeBalances(
    expenses.map((e) => ({
      amount: Number(e.amount),
      paidById: e.paidById,
      shares: e.shares.map((s) => ({ userId: s.userId, amount: Number(s.amount) })),
    }))
  );

  const paidSettlements = await prisma.settlement.findMany({
    where: { groupId, status: 'PAID' },
  });
  for (const s of paidSettlements) {
    const amt = Number(s.amount);
    balancesMap.set(s.fromId, (balancesMap.get(s.fromId) || 0) + amt);
    balancesMap.set(s.toId, (balancesMap.get(s.toId) || 0) - amt);
  }

  const suggestions = simplifyDebts(balancesMap);

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(suggestions.flatMap((s) => [s.fromId, s.toId]))) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json({
    suggestions: suggestions.map((s) => ({
      from: userMap.get(s.fromId),
      to: userMap.get(s.toId),
      amount: s.amount,
    })),
  });
});

// GET /groups/:groupId/settlements - settlement history
router.get('/settlements', requireGroupMember, async (req, res) => {
  const settlements = await prisma.settlement.findMany({
    where: { groupId: req.params.groupId },
    include: {
      from: { select: { id: true, name: true } },
      to: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ settlements });
});

// POST /groups/:groupId/settlements - record a settlement (pending or paid)
const createSettlementSchema = z.object({
  toId: z.string().uuid(),
  amount: z.number().positive(),
  status: z.enum(['PENDING', 'PAID']).optional(),
});

router.post('/settlements', requireGroupMember, async (req: any, res) => {
  const parsed = createSettlementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { toId, amount, status } = parsed.data;
  const groupId = req.params.groupId;
  const fromId = req.userId;

  const toMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: toId, groupId } },
  });
  if (!toMember) return res.status(400).json({ error: 'Recipient is not a member of this group' });

  const settlement = await prisma.settlement.create({
    data: {
      groupId,
      fromId,
      toId,
      amount: new Prisma.Decimal(amount),
      status: status || 'PENDING',
      paidAt: status === 'PAID' ? new Date() : null,
    },
    include: {
      from: { select: { id: true, name: true } },
      to: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ settlement });
});

// PATCH /groups/:groupId/settlements/:settlementId - mark as paid
router.patch('/settlements/:settlementId', requireGroupMember, async (req, res) => {
  const existing = await prisma.settlement.findFirst({
    where: { id: req.params.settlementId, groupId: req.params.groupId },
  });
  if (!existing) return res.status(404).json({ error: 'Settlement not found' });

  const settlement = await prisma.settlement.update({
    where: { id: req.params.settlementId },
    data: { status: 'PAID', paidAt: new Date() },
    include: {
      from: { select: { id: true, name: true } },
      to: { select: { id: true, name: true } },
    },
  });

  res.json({ settlement });
});

export default router;
