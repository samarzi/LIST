import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { verifyTelegramInitData } from '../middleware/auth';

const router = Router();

const AuthSchema = z.object({
  initData: z.string().min(1),
});

router.post('/telegram', async (req: Request, res: Response) => {
  const parsed = AuthSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log('Auth validation failed:', parsed.error);
    return res.status(400).json({ error: 'initData required' });
  }

  const { initData } = parsed.data;
  const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

  console.log('Auth request:', {
    initDataLength: initData.length,
    initDataPreview: initData.substring(0, 200),
    hasBotToken: !!botToken,
  });

  // В dev-режиме разрешаем тестовые данные
  let tgData: Record<string, string> | null = null;

  if (process.env.NODE_ENV === 'development' && initData.startsWith('test:')) {
    // Формат: test:{"id":123,"username":"test","first_name":"Test"}
    try {
      const userData = JSON.parse(initData.slice(5));
      tgData = { user: JSON.stringify(userData) };
      console.log('Using test data:', userData);
    } catch {
      console.error('Invalid test data format');
      return res.status(401).json({ error: 'Invalid test data' });
    }
  } else {
    tgData = verifyTelegramInitData(initData, botToken);
    console.log('Verification result:', tgData ? 'success' : 'failed');
    if (!tgData) {
      console.error('Telegram data verification failed');
      return res.status(401).json({ error: 'Invalid Telegram data' });
    }
  }

  let tgUser: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
  };

  try {
    tgUser = JSON.parse(tgData['user'] ?? '{}');
    if (!tgUser.id) throw new Error('No user id');
  } catch {
    return res.status(400).json({ error: 'Invalid user data' });
  }

  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(tgUser.id) },
    update: {
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      photoUrl: tgUser.photo_url ?? null,
      // displayName обновляем только если не задан пользователем вручную
    },
    create: {
      telegramId: BigInt(tgUser.id),
      username: tgUser.username ?? null,
      displayName: tgUser.first_name
        ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`
        : null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      photoUrl: tgUser.photo_url ?? null,
    },
  });

  const token = jwt.sign(
    { userId: Number(user.id), telegramId: Number(user.telegramId) },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  return res.json({
    token,
    user: {
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
      totalGoalsCompleted: user.totalGoalsCompleted,
      totalGoalsFailed: user.totalGoalsFailed,
      createdAt: user.createdAt,
    },
  });
});

export default router;
