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

router.post('/:id/enroll', requireAuth, async (req: Request, res: Response) => {
  const teacherProfileId = BigInt(req.params.id);
  const userId = BigInt(req.user!.userId);

  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    include: { user: { select: { id: true, litBalance: true, level: true, rating: true } } },
  });
  if (!profile) return res.status(404).json({ error: 'Teacher not found' });
  if (profile.userId === userId) return res.status(400).json({ error: 'Cannot enroll in yourself' });
  if (!['active', 'trial'].includes(profile.status)) return res.status(400).json({ error: 'Teacher not available' });

  const price = calculatePrice(profile.user.level, Number(profile.user.rating));

  const student = await prisma.user.findUnique({ where: { id: userId } });
  if (!student) return res.status(404).json({ error: 'User not found' });
  if (price > 0 && student.litBalance < price) {
    return res.status(402).json({ error: `Недостаточно LIT. Нужно ${price}, у тебя ${student.litBalance}` });
  }

  const existing = await prisma.teacherStudent.findFirst({
    where: { teacherId: profile.userId, studentId: userId, status: 'active' },
  });
  if (existing) return res.status(409).json({ error: 'Already enrolled' });

  await prisma.$transaction(async tx => {
    await tx.teacherStudent.create({
      data: { teacherId: profile.userId, studentId: userId },
    });
    await tx.teacherProfile.update({
      where: { id: teacherProfileId },
      data: {
        studentsCount: { increment: 1 },
        trialStudents: profile.status === 'trial' ? { increment: 1 } : undefined,
      },
    });
    if (price > 0) {
      await tx.user.update({ where: { id: userId }, data: { litBalance: { decrement: price } } });
      await tx.user.update({ where: { id: profile.userId }, data: { litBalance: { increment: price } } });
      await tx.litTransaction.create({
        data: { userId, amount: -price, type: 'teacher_fee', note: `Запись к учителю (${profile.topic ?? 'Разные темы'})` },
      });
      await tx.litTransaction.create({
        data: { userId: profile.userId, amount: price, type: 'teacher_income', note: `Новый ученик (${profile.topic ?? 'Разные темы'})` },
      });
    }
  });

  return res.status(201).json({ success: true, price });
});

router.get('/:id/students', requireAuth, async (req: Request, res: Response) => {
  const teacherProfileId = BigInt(req.params.id);
  const userId = BigInt(req.user!.userId);

  const profile = await prisma.teacherProfile.findUnique({ where: { id: teacherProfileId } });
  if (!profile) return res.status(404).json({ error: 'Not found' });
  if (profile.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  const students = await prisma.teacherStudent.findMany({
    where: { teacherId: profile.userId, status: 'active' },
    include: { student: { select: { id: true, username: true, displayName: true, level: true, photoUrl: true } } },
  });

  return res.json(students.map(s => ({
    id: Number(s.id),
    studentId: Number(s.studentId),
    student: { ...s.student, id: Number(s.student.id) },
    enrolledAt: s.createdAt,
  })));
});

function calculatePrice(level: number, rating: number): number {
  const base: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 10, 5: 15, 6: 25, 7: 35, 8: 50, 9: 70, 10: 125 };
  const basePrice = base[Math.min(level, 10)] ?? 0;
  return Math.round(basePrice * (rating / 5));
}

export default router;
