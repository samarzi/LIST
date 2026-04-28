import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { joinMatchingQueue, leaveMatchingQueue, matchUser, runMatching } from '../services/matching';
import { handleInactivityDecision, returnFromFreeze } from '../services/inactivity';

const router = Router();

router.get('/current', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const [asPartner, asWatcher] = await Promise.all([
    prisma.pair.findFirst({
      where: { partnerId: userId, status: 'active' },
      include: {
        watcher: { select: { id: true, username: true, displayName: true, photoUrl: true, level: true, rating: true } },
      },
    }),
    prisma.pair.findFirst({
      where: { watcherId: userId, status: 'active' },
      include: {
        partner: { select: { id: true, username: true, displayName: true, photoUrl: true, level: true, rating: true } },
      },
    }),
  ]);

  return res.json({
    asPartner: asPartner
      ? {
          id: Number(asPartner.id),
          status: asPartner.status,
          createdAt: asPartner.createdAt,
          watcher: { ...asPartner.watcher, id: Number(asPartner.watcher.id), rating: Number(asPartner.watcher.rating) },
        }
      : null,
    asWatcher: asWatcher
      ? {
          id: Number(asWatcher.id),
          status: asWatcher.status,
          createdAt: asWatcher.createdAt,
          partner: { ...asWatcher.partner, id: Number(asWatcher.partner.id), rating: Number(asWatcher.partner.rating) },
        }
      : null,
    inQueue: !asPartner && !asWatcher,
  });
});

// Партнёры смотрящего (для страницы "Хелпер")
router.get('/my-partners', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const pairs = await prisma.pair.findMany({
    where: { watcherId: userId, status: 'active' },
    include: {
      partner: {
        select: { id: true, username: true, displayName: true, photoUrl: true, level: true, rating: true },
        include: {
          goals: {
            where: { status: { in: ['in_progress', 'on_review', 'on_check', 'on_voting'] } },
            select: {
              id: true, title: true, deadline: true, status: true, successCriteria: true,
              _count: { select: { checkins: true } },
              proofs: { orderBy: { submittedAt: 'desc' }, take: 1, select: { description: true, mediaUrls: true } },
            },
          },
        },
      },
    },
  });

  return res.json(pairs.map(p => {
    const partnerGoals = (p.partner as unknown as {
      goals: {
        id: bigint; title: string; deadline: Date; status: string; successCriteria: string;
        _count: { checkins: number };
        proofs: { description: string; mediaUrls: string[] }[];
      }[] | undefined
    }).goals || [];

    return {
      pairId: Number(p.id),
      partner: {
        ...p.partner,
        id: Number(p.partner.id),
        rating: Number(p.partner.rating),
        activeGoals: partnerGoals.map((g) => ({
          id: Number(g.id),
          title: g.title,
          successCriteria: g.successCriteria,
          deadline: g.deadline,
          status: g.status,
          checkinsCount: g._count.checkins,
          latestProof: g.proofs[0] ?? null,
        })),
      },
    };
  }));
});

// Вход в очередь матчинга
router.post('/queue/join', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  console.log('=== POST /pairs/queue/join called ===');
  console.log('User ID:', userId.toString());

  const result = await joinMatchingQueue(userId);
  console.log('joinMatchingQueue result:', result);
  
  if (!result.success) {
    console.log('Join queue failed:', result.message);
    return res.status(400).json({ error: result.message });
  }

  // Пытаемся сразу найти пару
  console.log('Calling matchUser...');
  const matchResult = await matchUser(userId);
  console.log('matchUser result:', matchResult);
  
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

// Смена партнера/смотрящего
router.post('/change', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({ error: 'Укажите причину смены' });
  }

  // Проверяем, есть ли активная пара
  const currentPair = await prisma.pair.findFirst({
    where: {
      OR: [
        { partnerId: userId, status: 'active' },
        { watcherId: userId, status: 'active' },
      ],
    },
  });

  if (!currentPair) {
    return res.status(404).json({ error: 'Нет активной пары' });
  }

  // Проверяем cooldown (2 недели)
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  if (currentPair.createdAt > twoWeeksAgo) {
    return res.status(400).json({ error: 'Смену партнера можно раз в 2 недели' });
  }

  // Завершаем текущую пару
  await prisma.pair.update({
    where: { id: currentPair.id },
    data: {
      status: 'ended',
      endedAt: new Date(),
    },
  });

  // Добавляем пользователя в очередь поиска нового партнера
  await joinMatchingQueue(userId);

  return res.json({ success: true, message: 'Пара завершена, вы добавлены в очередь поиска' });
});

export default router;
