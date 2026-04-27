import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const VoteSchema = z.object({
  scoreGoal: z.number().int().min(0).max(10),
  scoreWatcher: z.number().int().min(0).max(10),
});

router.get('/next', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const alreadyVoted = await prisma.vote.findMany({
    where: { voterId: userId },
    select: { goalId: true },
  });
  const votedIds = alreadyVoted.map(v => v.goalId);

  const session = await prisma.votingSession.findFirst({
    where: {
      status: 'open',
      deadline: { gte: new Date() },
      goalId: { notIn: votedIds },
      goal: { userId: { not: userId } },
    },
    include: {
      goal: {
        include: {
          user: { select: { id: true, username: true, displayName: true, photoUrl: true, level: true } },
          proofs: { orderBy: { submittedAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { deadline: 'asc' },
  });

  if (!session) return res.json({ session: null });

  return res.json({
    session: {
      id: Number(session.id),
      goalId: Number(session.goalId),
      requiredVotes: session.requiredVotes,
      votesCount: session.votesCount,
      deadline: session.deadline,
      goal: {
        id: Number(session.goal.id),
        title: session.goal.title,
        successCriteria: session.goal.successCriteria,
        difficulty: session.goal.difficulty,
        user: { ...session.goal.user, id: Number(session.goal.user.id) },
        proof: session.goal.proofs[0]
          ? {
              description: session.goal.proofs[0].description,
              mediaUrls: session.goal.proofs[0].mediaUrls,
            }
          : null,
      },
    },
  });
});

router.post('/:id/vote', requireAuth, async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const parsed = VoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const session = await prisma.votingSession.findUnique({
    where: { id: BigInt(sessionId) },
  });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'open') return res.status(400).json({ error: 'Voting closed' });

  const existing = await prisma.vote.findUnique({
    where: { goalId_voterId: { goalId: session.goalId, voterId: BigInt(req.user!.userId) } },
  });
  if (existing) return res.status(409).json({ error: 'Already voted' });

  await prisma.$transaction([
    prisma.vote.create({
      data: {
        goalId: session.goalId,
        voterId: BigInt(req.user!.userId),
        scoreGoal: parsed.data.scoreGoal,
        scoreWatcher: parsed.data.scoreWatcher,
      },
    }),
    prisma.votingSession.update({
      where: { id: BigInt(sessionId) },
      data: { votesCount: { increment: 1 } },
    }),
    // Бонус за голосование — будет пересчитан при закрытии
    prisma.litTransaction.create({
      data: {
        userId: BigInt(req.user!.userId),
        amount: 2,
        type: 'vote_bonus',
        relatedId: session.goalId,
        note: 'Бонус за участие в голосовании',
      },
    }),
    prisma.user.update({
      where: { id: BigInt(req.user!.userId) },
      data: { litBalance: { increment: 2 } },
    }),
  ]);

  return res.json({ success: true });
});

export default router;
