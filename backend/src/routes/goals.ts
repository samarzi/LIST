import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const CreateGoalSchema = z.object({
  title: z.string().min(3).max(100),
  successCriteria: z.string().min(30).max(300),
  motivation: z.string().max(200).optional(),
  actionPlan: z.string().max(500).optional(),
  proofType: z.enum(['video', 'screenshot', 'link', 'document', 'combined']),
  deadline: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  stakeLit: z.number().int().min(0).optional(),
});

const DifficultySchema = z.object({
  difficulty: z.number().int().min(0).max(10),
  comment: z.string().max(300).optional(),
});

const ProofSchema = z.object({
  description: z.string().min(10).max(1000),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
});

const CheckinSchema = z.object({
  content: z.string().max(1000).optional(),
  mediaUrls: z.array(z.string().url()).max(5).optional(),
  goalId: z.number().int(),
});

function serializeGoal(g: Record<string, unknown>) {
  return {
    ...g,
    id: Number(g.id as bigint),
    userId: Number(g.userId as bigint),
    pairId: g.pairId ? Number(g.pairId as bigint) : null,
  };
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const goals = await prisma.goal.findMany({
    where: { userId: BigInt(req.user!.userId) },
    include: {
      _count: { select: { checkins: true } },
      votingSession: { select: { status: true, deadline: true, votesCount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(goals.map(g => ({
    id: Number(g.id),
    title: g.title,
    successCriteria: g.successCriteria,
    motivation: g.motivation,
    proofType: g.proofType,
    deadline: g.deadline,
    difficulty: g.difficulty,
    stakeLit: g.stakeLit,
    status: g.status,
    createdAt: g.createdAt,
    completedAt: g.completedAt,
    checkinsCount: g._count.checkins,
    votingSession: g.votingSession,
  })));
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateGoalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const activePair = await prisma.pair.findFirst({
    where: {
      studentId: BigInt(req.user!.userId),
      status: 'active',
    },
  });

  const goal = await prisma.goal.create({
    data: {
      userId: BigInt(req.user!.userId),
      pairId: activePair ? activePair.id : null,
      title: parsed.data.title,
      successCriteria: parsed.data.successCriteria,
      motivation: parsed.data.motivation,
      actionPlan: parsed.data.actionPlan,
      proofType: parsed.data.proofType,
      deadline: new Date(parsed.data.deadline),
      stakeLit: parsed.data.stakeLit ?? 0,
      status: activePair ? 'on_review' : 'in_progress',
    },
  });

  return res.status(201).json({ id: Number(goal.id), status: goal.status });
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const goalId = Number(req.params.id);
  if (isNaN(goalId)) return res.status(400).json({ error: 'Invalid id' });

  const goal = await prisma.goal.findUnique({
    where: { id: BigInt(goalId) },
    include: {
      user: { select: { id: true, username: true, displayName: true, photoUrl: true, level: true } },
      checkins: { orderBy: { createdAt: 'desc' }, take: 20 },
      proofs: { orderBy: { submittedAt: 'desc' }, take: 1 },
      votingSession: true,
    },
  });

  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const isOwner = Number(goal.userId) === req.user!.userId;
  const activePair = isOwner ? null : await prisma.pair.findFirst({
    where: { watcherId: BigInt(req.user!.userId), studentId: goal.userId, status: 'active' },
  });
  const canView = isOwner || !!activePair;
  if (!canView) return res.status(403).json({ error: 'Forbidden' });

  return res.json({
    id: Number(goal.id),
    title: goal.title,
    successCriteria: goal.successCriteria,
    motivation: goal.motivation,
    actionPlan: goal.actionPlan,
    proofType: goal.proofType,
    deadline: goal.deadline,
    difficulty: goal.difficulty,
    stakeLit: goal.stakeLit,
    status: goal.status,
    createdAt: goal.createdAt,
    completedAt: goal.completedAt,
    isOwner,
    user: { ...goal.user, id: Number(goal.user.id) },
    checkins: goal.checkins.map(c => ({ ...c, id: Number(c.id), goalId: Number(c.goalId), userId: Number(c.userId) })),
    latestProof: goal.proofs[0] ?? null,
    votingSession: goal.votingSession,
  });
});

router.put('/:id/difficulty', requireAuth, async (req: Request, res: Response) => {
  const goalId = Number(req.params.id);
  const parsed = DifficultySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const goal = await prisma.goal.findUnique({ where: { id: BigInt(goalId) } });
  if (!goal) return res.status(404).json({ error: 'Not found' });

  const pair = await prisma.pair.findFirst({
    where: { id: goal.pairId ?? undefined, watcherId: BigInt(req.user!.userId) },
  });
  if (!pair) return res.status(403).json({ error: 'Not watcher for this goal' });
  if (goal.status !== 'on_review') return res.status(400).json({ error: 'Goal not in review status' });

  const newStatus = parsed.data.difficulty === 0 ? 'rejected' : 'in_progress';

  await prisma.goal.update({
    where: { id: BigInt(goalId) },
    data: { difficulty: parsed.data.difficulty, status: newStatus },
  });

  return res.json({ success: true, status: newStatus });
});

router.post('/:id/proof', requireAuth, async (req: Request, res: Response) => {
  const goalId = Number(req.params.id);
  const parsed = ProofSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const goal = await prisma.goal.findUnique({ where: { id: BigInt(goalId) } });
  if (!goal) return res.status(404).json({ error: 'Not found' });
  if (Number(goal.userId) !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });
  if (goal.status !== 'in_progress') return res.status(400).json({ error: 'Goal not in progress' });

  await prisma.$transaction([
    prisma.proof.create({
      data: {
        goalId: BigInt(goalId),
        description: parsed.data.description,
        mediaUrls: parsed.data.mediaUrls ?? [],
      },
    }),
    prisma.goal.update({
      where: { id: BigInt(goalId) },
      data: { status: 'on_check' },
    }),
  ]);

  return res.json({ success: true });
});

router.post('/:id/confirm', requireAuth, async (req: Request, res: Response) => {
  const goalId = Number(req.params.id);
  const { confirmed, note } = req.body;

  const goal = await prisma.goal.findUnique({
    where: { id: BigInt(goalId) },
    include: { pair: true },
  });
  if (!goal || !goal.pair) return res.status(404).json({ error: 'Not found' });
  if (Number(goal.pair.watcherId) !== req.user!.userId) return res.status(403).json({ error: 'Not watcher' });
  if (goal.status !== 'on_check') return res.status(400).json({ error: 'Goal not on check' });

  if (!confirmed) {
    await prisma.$transaction([
      prisma.proof.updateMany({
        where: { goalId: BigInt(goalId), watcherConfirmed: null },
        data: { watcherConfirmed: false, watcherNote: note ?? null },
      }),
      prisma.goal.update({
        where: { id: BigInt(goalId) },
        data: { status: 'in_progress' },
      }),
    ]);
    return res.json({ success: true, status: 'in_progress' });
  }

  const difficulty = goal.difficulty ?? 5;
  const requiredVotes = difficulty <= 3 ? 5 : difficulty <= 6 ? 10 : difficulty <= 9 ? 20 : 35;
  const votingDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.proof.updateMany({
      where: { goalId: BigInt(goalId), watcherConfirmed: null },
      data: { watcherConfirmed: true, confirmedAt: new Date() },
    }),
    prisma.goal.update({
      where: { id: BigInt(goalId) },
      data: { status: 'on_voting' },
    }),
    prisma.votingSession.create({
      data: {
        goalId: BigInt(goalId),
        requiredVotes,
        deadline: votingDeadline,
      },
    }),
  ]);

  return res.json({ success: true, status: 'on_voting' });
});

router.post('/checkin', requireAuth, async (req: Request, res: Response) => {
  const parsed = CheckinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const goal = await prisma.goal.findUnique({ where: { id: BigInt(parsed.data.goalId) } });
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (Number(goal.userId) !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });
  if (goal.status !== 'in_progress') return res.status(400).json({ error: 'Goal not active' });

  const checkin = await prisma.checkin.create({
    data: {
      goalId: BigInt(parsed.data.goalId),
      userId: BigInt(req.user!.userId),
      content: parsed.data.content,
      mediaUrls: parsed.data.mediaUrls ?? [],
    },
  });

  return res.status(201).json({ id: Number(checkin.id) });
});

export default router;
