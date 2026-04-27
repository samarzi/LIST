import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  firstName: z.string().max(64).optional(),
  lastName: z.string().max(64).optional(),
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(req.user!.userId) },
    include: {
      teacherProfile: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    id: Number(user.id),
    telegramId: Number(user.telegramId),
    username: user.username,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    level: user.level,
    rating: Number(user.rating),
    litBalance: user.litBalance,
    isTeacher: user.isTeacher,
    isArbitrator: user.isArbitrator,
    teacherRating: user.teacherRating ? Number(user.teacherRating) : null,
    freezeCount30d: user.freezeCount30d,
    totalGoalsCompleted: user.totalGoalsCompleted,
    totalGoalsFailed: user.totalGoalsFailed,
    createdAt: user.createdAt,
    teacherProfile: user.teacherProfile
      ? {
          topic: user.teacherProfile.topic,
          description: user.teacherProfile.description,
          status: user.teacherProfile.status,
          studentsCount: user.teacherProfile.studentsCount,
        }
      : null,
  });
});

router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: BigInt(req.user!.userId) },
    data: parsed.data,
  });

  return res.json({ id: Number(user.id), displayName: user.displayName, firstName: user.firstName, lastName: user.lastName });
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid id' });

  const user = await prisma.user.findUnique({
    where: { id: BigInt(targetId) },
    include: {
      teacherProfile: { select: { topic: true, description: true, status: true, studentsCount: true } },
      goals: {
        where: { status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, difficulty: true, completedAt: true },
      },
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    id: Number(user.id),
    username: user.username,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    level: user.level,
    rating: Number(user.rating),
    isTeacher: user.isTeacher,
    isArbitrator: user.isArbitrator,
    totalGoalsCompleted: user.totalGoalsCompleted,
    totalGoalsFailed: user.totalGoalsFailed,
    createdAt: user.createdAt,
    teacherProfile: user.teacherProfile,
    recentGoals: user.goals.map(g => ({ ...g, id: Number(g.id) })),
  });
});

export default router;
