import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const ReportSchema = z.object({
  goalId: z.number().int(),
  reason: z.string().min(10).max(500),
});

const DecisionSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(500).optional(),
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const goal = await prisma.goal.findUnique({ where: { id: BigInt(parsed.data.goalId) } });
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const existing = await prisma.report.findFirst({
    where: { reporterId: BigInt(req.user!.userId), goalId: BigInt(parsed.data.goalId), status: 'pending' },
  });
  if (existing) return res.status(409).json({ error: 'Already reported' });

  const report = await prisma.report.create({
    data: {
      reporterId: BigInt(req.user!.userId),
      goalId: BigInt(parsed.data.goalId),
      reason: parsed.data.reason,
    },
  });

  return res.status(201).json({ id: Number(report.id) });
});

router.get('/queue', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: BigInt(req.user!.userId) } });
  if (!user?.isArbitrator) return res.status(403).json({ error: 'Arbitrator access required' });

  const reports = await prisma.report.findMany({
    where: { status: 'pending', arbitratorId: null },
    include: {
      goal: { select: { id: true, title: true, successCriteria: true, status: true } },
      reporter: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  return res.json(reports.map(r => ({
    id: Number(r.id),
    reason: r.reason,
    createdAt: r.createdAt,
    goal: { ...r.goal, id: Number(r.goal.id) },
    reporter: { ...r.reporter, id: Number(r.reporter.id) },
  })));
});

router.post('/:id/decide', requireAuth, async (req: Request, res: Response) => {
  const reportId = Number(req.params.id);
  const parsed = DecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: BigInt(req.user!.userId) } });
  if (!user?.isArbitrator) return res.status(403).json({ error: 'Arbitrator access required' });

  const report = await prisma.report.findUnique({ where: { id: BigInt(reportId) } });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.status !== 'pending') return res.status(400).json({ error: 'Already decided' });

  await prisma.$transaction([
    prisma.report.update({
      where: { id: BigInt(reportId) },
      data: {
        status: parsed.data.approved ? 'approved' : 'rejected',
        arbitratorId: BigInt(req.user!.userId),
        decisionNote: parsed.data.note,
        resolvedAt: new Date(),
      },
    }),
    // Арбитр получает LIT за решение
    prisma.litTransaction.create({
      data: {
        userId: BigInt(req.user!.userId),
        amount: 1,
        type: 'arbitration_reward',
        relatedId: BigInt(reportId),
        note: 'Вознаграждение за решение жалобы',
      },
    }),
    prisma.user.update({
      where: { id: BigInt(req.user!.userId) },
      data: { litBalance: { increment: 1 } },
    }),
  ]);

  return res.json({ success: true });
});

export default router;
