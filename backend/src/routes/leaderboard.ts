import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const type = (req.query.type as string) ?? 'rating';
  const limit = 50;

  console.log('Leaderboard request:', { type, userId: req.user!.userId });

  const orderBy =
    type === 'lit'
      ? { litBalance: 'desc' as const }
      : type === 'goals'
      ? { totalGoalsCompleted: 'desc' as const }
      : { rating: 'desc' as const };

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      photoUrl: true,
      level: true,
      rating: true,
      litBalance: true,
      totalGoalsCompleted: true,
      isTeacher: true,
      isArbitrator: true,
    },
    orderBy,
    take: limit,
  });

  console.log('Leaderboard users found:', users.length);

  const currentUser = await prisma.user.findUnique({
    where: { id: BigInt(req.user!.userId) },
    select: {
      rating: true,
      litBalance: true,
      totalGoalsCompleted: true,
    },
  });

  if (!currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userValue =
    type === 'lit'
      ? currentUser.litBalance
      : type === 'goals'
      ? currentUser.totalGoalsCompleted
      : Number(currentUser.rating);

  const myRank = await prisma.user.count({
    where: {
      [type === 'lit' ? 'litBalance' : type === 'goals' ? 'totalGoalsCompleted' : 'rating']: {
        gt: userValue,
      },
    },
  });

  return res.json({
    users: users.map((u, i) => ({
      rank: i + 1,
      id: Number(u.id),
      username: u.username,
      displayName: u.displayName,
      photoUrl: u.photoUrl,
      level: u.level,
      rating: Number(u.rating),
      litBalance: u.litBalance,
      totalGoalsCompleted: u.totalGoalsCompleted,
      isTeacher: u.isTeacher,
      isArbitrator: u.isArbitrator,
    })),
    myRank: myRank + 1,
  });
});

export default router;
