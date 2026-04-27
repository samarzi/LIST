import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const ApplySchema = z.object({
  topic: z.string().min(3).max(200),
  description: z.string().min(20).max(1000),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { topic, minRating } = req.query;

  const teachers = await prisma.teacherProfile.findMany({
    where: {
      status: { in: ['active', 'trial'] },
      topic: topic ? { contains: topic as string, mode: 'insensitive' } : undefined,
      user: minRating ? { teacherRating: { gte: Number(minRating) } } : undefined,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          photoUrl: true,
          level: true,
          rating: true,
          teacherRating: true,
          totalGoalsCompleted: true,
        },
      },
    },
    orderBy: { user: { teacherRating: 'desc' } },
    take: 50,
  });

  return res.json(teachers.map(t => ({
    id: Number(t.id),
    userId: Number(t.userId),
    topic: t.topic,
    description: t.description,
    status: t.status,
    studentsCount: t.studentsCount,
    trialStudents: t.trialStudents,
    user: {
      ...t.user,
      id: Number(t.user.id),
      rating: Number(t.user.rating),
      teacherRating: t.user.teacherRating ? Number(t.user.teacherRating) : null,
      price: calculatePrice(t.user.level, Number(t.user.rating)),
    },
  })));
});

router.post('/apply', requireAuth, async (req: Request, res: Response) => {
  const parsed = ApplySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: BigInt(req.user!.userId) } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.level < 4) return res.status(403).json({ error: 'Level 4+ required' });
  if (Number(user.rating) < 3.5) return res.status(403).json({ error: 'Rating 3.5+ required' });
  if (user.totalGoalsCompleted < 5) return res.status(403).json({ error: '5+ completed goals required' });

  const existing = await prisma.teacherProfile.findUnique({ where: { userId: BigInt(req.user!.userId) } });
  if (existing) return res.status(409).json({ error: 'Already applied' });

  const [profile] = await prisma.$transaction([
    prisma.teacherProfile.create({
      data: {
        userId: BigInt(req.user!.userId),
        topic: parsed.data.topic,
        description: parsed.data.description,
      },
    }),
    prisma.user.update({
      where: { id: BigInt(req.user!.userId) },
      data: { isTeacher: true },
    }),
  ]);

  return res.status(201).json({ id: Number(profile.id), status: profile.status });
});

function calculatePrice(level: number, rating: number): number {
  const base: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 10, 5: 15, 6: 25, 7: 35, 8: 50, 9: 70, 10: 125 };
  const basePrice = base[Math.min(level, 10)] ?? 0;
  return Math.round(basePrice * (rating / 5));
}

export default router;
