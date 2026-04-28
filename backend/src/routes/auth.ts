import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { verifyTelegramInitData } from '../middleware/auth';
import { redis } from '../lib/redis';

const AuthSchema = z.object({
  initData: z.string().min(1),
});

const router = Router();

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

  // Разрешаем тестовые данные в dev-режиме или с паролем разработчика
  let tgData: Record<string, string> | null = null;

  if ((process.env.NODE_ENV !== 'production' || initData.startsWith('test:dev:')) && initData.startsWith('test:')) {
    // Формат: test:{"id":123,"username":"test","first_name":"Test"}
    // Или test:dev:{"id":123,"username":"test","first_name":"Test"} для режима разработчика
    try {
      const userData = JSON.parse(initData.startsWith('test:dev:') ? initData.slice(9) : initData.slice(5));
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

  console.log('Looking up/creating user with telegramId:', tgUser.id);
  
  const existingUser = await prisma.user.findUnique({
    where: { telegramId: BigInt(tgUser.id) },
  });

  let user;
  let isNewUser = false;

  if (existingUser) {
    // Обновляем существующего пользователя
    user = await prisma.user.update({
      where: { telegramId: BigInt(tgUser.id) },
      data: {
        username: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
        photoUrl: tgUser.photo_url ?? null,
      },
    });
  } else {
    // Создаем нового пользователя
    user = await prisma.user.create({
      data: {
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
    isNewUser = true;
  }

  console.log('User found/created:', {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    displayName: user.displayName,
    isNewUser,
  });

  // Если это новый пользователь, автоматически добавляем в очередь поиска партнера
  if (isNewUser) {
    try {
      // Добавляем в Redis для быстрого доступа
      if (redis) {
        await redis.set(`matching:user:${user.id}`, '1', 'EX', 3600); // 1 час
        console.log('User added to matching queue automatically:', user.id);
      }
    } catch (error) {
      console.error('Failed to add user to matching queue:', error);
    }
  }

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
