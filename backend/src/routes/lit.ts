import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/balance', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(req.user!.userId) },
    select: { litBalance: true },
  });
  return res.json({ balance: user?.litBalance ?? 0 });
});

router.get('/history', requireAuth, async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = 20;

  const [transactions, total] = await Promise.all([
    prisma.litTransaction.findMany({
      where: { userId: BigInt(req.user!.userId) },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.litTransaction.count({ where: { userId: BigInt(req.user!.userId) } }),
  ]);

  return res.json({
    transactions: transactions.map(t => ({
      id: Number(t.id),
      amount: t.amount,
      type: t.type,
      note: t.note,
      createdAt: t.createdAt,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

export default router;
