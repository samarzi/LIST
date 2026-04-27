import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { joinMatchingQueue, leaveMatchingQueue, matchUser, runMatching } from '../services/matching';
import { handleInactivityDecision, returnFromFreeze } from '../services/inactivity';

const router = Router();

router.get('/current', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const [asStudent, asWatcher] = await Promise.all([
    prisma.pair.findFirst({
      where: { studentId: userId, status: 'active' },
      include: {
        watcher: { select: { id: true, username: true, displayName: true, photoUrl: true, level: true, rating: true } },
      },
    }),
    prisma.pair.findFirst({
      where: { watcherId: userId, status: 'active' },
      include: {
        student: { select: { id: true, username: true, displayName: true, photoUrl: true, level: true, rating: true } },
      },
    }),
  ]);

  return res.json({
    asStudent: asStudent
      ? {
          id: Number(asStudent.id),
          status: asStudent.status,
          createdAt: asStudent.createdAt,
          watcher: { ...asStudent.watcher, id: Number(asStudent.watcher.id), rating: Number(asStudent.watcher.rating) },
        }
      : null,
    asWatcher: asWatcher
      ? {
          id: Number(asWatcher.id),
          status: asWatcher.status,
          createdAt: asWatcher.createdAt,
          student: { ...asWatcher.student, id: Number(asWatcher.student.id), rating: Number(asWatcher.student.rating) },
        }
      : null,
    inQueue: !asStudent && !asWatcher,
  });
});

// Запрос на смену пары
router.post('/change', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required' });

  const pair = await prisma.pair.findFirst({
    where: { studentId: userId, status: 'active' },
  });
  if (!pair) return res.status(404).json({ error: 'No active pair' });

  // Проверка: не чаще 1 раза в 2 недели
  const recentEnd = await prisma.pair.findFirst({
    where: {
      studentId: userId,
      status: 'ended',
      endedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
  });
  if (recentEnd) {
    return res.status(429).json({ error: 'Can only change pair once every 2 weeks' });
  }

  await prisma.pair.update({
    where: { id: pair.id },
    data: { status: 'ended', endedAt: new Date() },
  });

  return res.json({ success: true, message: 'Pair ended, searching for new partner' });
});

// Студенты смотрящего (для страницы "Слежу")
router.get('/my-students', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const pairs = await prisma.pair.findMany({
    where: { watcherId: userId, status: 'active' },
    include: {
      student: {
        select: { id: true, username: true, displayName: true, photoUrl: true, level: true, rating: true },
        include: {
          goals: {
            where: { status: 'in_progress' },
            select: {
              id: true, title: true, deadline: true, status: true,
              _count: { select: { checkins: true } },
            },
          },
        },
      },
    },
  });

  return res.json(pairs.map(p => ({
    pairId: Number(p.id),
    student: {
      ...p.student,
      id: Number(p.student.id),
      rating: Number(p.student.rating),
      activeGoals: (p.student as unknown as { goals: { id: bigint; title: string; deadline: Date; status: string; _count: { checkins: number } }[] }).goals.map((g) => ({
        id: Number(g.id),
        title: g.title,
        deadline: g.deadline,
        status: g.status,
        checkinsCount: g._count.checkins,
      })),
    },
  })));
});

// Вход в очередь матчинга
router.post('/queue/join', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const result = await joinMatchingQueue(userId);
  
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  // Пытаемся сразу найти пару
  const matchResult = await matchUser(userId);
  
  return res.json({ 
    success: true, 
    message: result.message,
    matched: matchResult.matched,
    partner: matchResult.partner ? {
      id: Number(matchResult.partner.id),
      username: matchResult.partner.username,
      displayName: matchResult.partner.displayName,
    } : null,
  });
});

// Выход из очереди матчинга
router.post('/queue/leave', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  await leaveMatchingQueue(userId);
  
  return res.json({ success: true, message: 'Вы вышли из очереди поиска партнёра' });
});

// Запуск матчинга (для cron или админки)
router.post('/match', requireAuth, async (req: Request, res: Response) => {
  // В продакшене добавить проверку админских прав
  const result = await runMatching();

  return res.json({ success: true, pairsCreated: result.pairsCreated });
});

// Обработка решения при неактивности партнёра
router.post('/inactivity/decision', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const { pairId, decision } = req.body;

  if (!pairId || !decision || !['wait', 'replace'].includes(decision)) {
    return res.status(400).json({ error: 'Неверные параметры' });
  }

  const result = await handleInactivityDecision(BigInt(pairId), userId, decision);

  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json({ success: true, message: result.message });
});

// Возврат из заморозки
router.post('/inactivity/return', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const result = await returnFromFreeze(userId);

  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json({ success: true, message: result.message });
});

export default router;
