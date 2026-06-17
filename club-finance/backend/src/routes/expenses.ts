import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireGroupMember } from '../middleware/group';
import { computeShares, SplitType } from '../utils/split';

const router = Router({ mergeParams: true });

router.use(authenticate);

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().optional(),
  notes: z.string().optional(),
  paidById: z.string().uuid(),
  splitType: z.enum(['EQUAL', 'CUSTOM', 'PERCENTAGE']),
  participants: z.array(z.string().uuid()).min(1),
  customAmounts: z.record(z.number()).optional(),
  percentages: z.record(z.number()).optional(),
});

// Create expense
router.post('/', requireGroupMember, async (req: AuthRequest, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { description, amount, category, notes, paidById, splitType, participants, customAmounts, percentages } =
    parsed.data;

  // Verify paidBy and all participants are group members
  const groupId = req.params.groupId;
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const memberIds = new Set(members.map((m) => m.userId));

  if (!memberIds.has(paidById)) {
    return res.status(400).json({ error: 'paidById must be a member of the group' });
  }
  for (const p of participants) {
    if (!memberIds.has(p)) {
      return res.status(400).json({ error: `participant ${p} is not a member of the group` });
    }
  }

  let shares;
  try {
    shares = computeShares({
      splitType: splitType as SplitType,
      amount,
      participants,
      customAmounts,
      percentages,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  const expense = await prisma.expense.create({
    data: {
      groupId,
      description,
      amount: new Prisma.Decimal(amount),
      category,
      notes,
      paidById,
      splitType,
      shares: {
        create: shares.map((s) => ({
          userId: s.userId,
          amount: new Prisma.Decimal(s.amount),
          percentage: s.percentage != null ? new Prisma.Decimal(s.percentage) : undefined,
        })),
      },
    },
    include: { shares: true, paidBy: { select: { id: true, name: true } } },
  });

  res.status(201).json({ expense });
});

// List expenses for a group
router.get('/', requireGroupMember, async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: { groupId: req.params.groupId },
    include: {
      shares: { include: { user: { select: { id: true, name: true } } } },
      paidBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ expenses });
});

// Get single expense
router.get('/:expenseId', requireGroupMember, async (req, res) => {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.expenseId, groupId: req.params.groupId },
    include: {
      shares: { include: { user: { select: { id: true, name: true } } } },
      paidBy: { select: { id: true, name: true } },
    },
  });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  res.json({ expense });
});

// Update expense (recomputes shares)
router.put('/:expenseId', requireGroupMember, async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.expense.findFirst({
    where: { id: req.params.expenseId, groupId: req.params.groupId },
  });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const { description, amount, category, notes, paidById, splitType, participants, customAmounts, percentages } =
    parsed.data;

  let shares;
  try {
    shares = computeShares({
      splitType: splitType as SplitType,
      amount,
      participants,
      customAmounts,
      percentages,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  await prisma.expenseShare.deleteMany({ where: { expenseId: req.params.expenseId } });

  const expense = await prisma.expense.update({
    where: { id: req.params.expenseId },
    data: {
      description,
      amount: new Prisma.Decimal(amount),
      category,
      notes,
      paidById,
      splitType,
      shares: {
        create: shares.map((s) => ({
          userId: s.userId,
          amount: new Prisma.Decimal(s.amount),
          percentage: s.percentage != null ? new Prisma.Decimal(s.percentage) : undefined,
        })),
      },
    },
    include: { shares: true, paidBy: { select: { id: true, name: true } } },
  });

  res.json({ expense });
});

// Delete expense
router.delete('/:expenseId', requireGroupMember, async (req, res) => {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.expenseId, groupId: req.params.groupId },
  });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  await prisma.expense.delete({ where: { id: req.params.expenseId } });
  res.status(204).send();
});

export default router;
