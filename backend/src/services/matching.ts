import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { Telegraf } from 'telegraf';

interface MatchingQueueUser {
  id: bigint;
  telegramId: bigint;
  username: string | null;
  displayName: string | null;
  level: number;
  rating: number;
}

let botInstance: Telegraf | null = null;

/**
 * Инициализирует бот для отправки уведомлений
 */
export function setBotInstance(bot: Telegraf) {
  botInstance = bot;
}

/**
 * Проверяет совместимость двух пользователей для создания пары
 * Условия:
 * - Уровни отличаются не более чем на 2
 * - Они не были в паре раньше
 */
async function areCompatible(user1: MatchingQueueUser, user2: MatchingQueueUser): Promise<boolean> {
  // Проверка уровня (разница не более 2)
  if (Math.abs(user1.level - user2.level) > 2) {
    return false;
  }

  // Проверка: не были ли они в паре раньше
  const previousPair = await prisma.pair.findFirst({
    where: {
      OR: [
        { watcherId: user1.id, studentId: user2.id },
        { watcherId: user2.id, studentId: user1.id },
      ],
    },
  });

  if (previousPair) {
    return false;
  }

  return true;
}

/**
 * Добавляет пользователя в очередь матчинга
 */
export async function joinMatchingQueue(userId: bigint): Promise<{ success: boolean; message: string }> {
  // Проверяем, есть ли уже активная пара
  const existingPair = await prisma.pair.findFirst({
    where: {
      OR: [
        { watcherId: userId, status: 'active' },
        { studentId: userId, status: 'active' },
      ],
    },
  });

  if (existingPair) {
    return { success: false, message: 'У вас уже есть активная пара' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { success: false, message: 'Пользователь не найден' };
  }

  // Добавляем в Redis для быстрого доступа
  await redis.set(`matching:user:${userId}`, '1', 'EX', 3600); // 1 час

  return { success: true, message: 'Вы добавлены в очередь поиска партнёра' };
}

/**
 * Удаляет пользователя из очереди матчинга
 */
export async function leaveMatchingQueue(userId: bigint): Promise<void> {
  await redis.del(`matching:user:${userId}`);
}

/**
 * Получает пользователей, ожидающих матчинга
 * Для MVP: находим пользователей без активной пары
 */
async function getWaitingUsers(): Promise<MatchingQueueUser[]> {
  const users = await prisma.user.findMany({
    where: {
      // Нет активной пары как смотрящий
      watcherPairs: {
        none: { status: 'active' },
      },
      // Нет активной пары как ученик
      studentPairs: {
        none: { status: 'active' },
      },
    },
    select: {
      id: true,
      telegramId: true,
      username: true,
      displayName: true,
      level: true,
      rating: true,
    },
    take: 100, // Ограничиваем для производительности
  });

  return users.map(u => ({
    ...u,
    rating: Number(u.rating),
  }));
}

/**
 * Создаёт пару между двумя пользователями
 * Асимметричная пара: каждый является смотрящим для другого
 */
async function createPair(user1: MatchingQueueUser, user2: MatchingQueueUser) {
  // Создаём две пары (асимметричные)
  await prisma.$transaction([
    // Пользователь 1 — смотрящий для пользователя 2
    prisma.pair.create({
      data: {
        watcherId: user1.id,
        studentId: user2.id,
        status: 'active',
      },
    }),
    // Пользователь 2 — смотрящий для пользователя 1
    prisma.pair.create({
      data: {
        watcherId: user2.id,
        studentId: user1.id,
        status: 'active',
      },
    }),
  ]);

  // Удаляем из очереди матчинга
  await redis.del(`matching:user:${user1.id}`);
  await redis.del(`matching:user:${user2.id}`);

  // Отправляем уведомления обоим пользователям
  if (botInstance) {
    const name1 = user1.displayName ?? user1.username ?? 'Партнёр';
    const name2 = user2.displayName ?? user2.username ?? 'Партнёр';
    const username1 = user1.username ? `@${user1.username}` : 'нет username';
    const username2 = user2.username ? `@${user2.username}` : 'нет username';

    // Уведомление для пользователя 1
    await botInstance.telegram.sendMessage(
      Number(user1.telegramId),
      `🎉 *Найден партнёр!*\n\n` +
      `Твой смотрящий: ${name2}\n` +
      `Telegram: ${username2}\n` +
      `Уровень: ${user2.level}\n\n` +
      `Свяжись с партнёром и начните работу!`,
      { parse_mode: 'Markdown' }
    );

    // Уведомление для пользователя 2
    await botInstance.telegram.sendMessage(
      Number(user2.telegramId),
      `🎉 *Найден партнёр!*\n\n` +
      `Твой смотрящий: ${name1}\n` +
      `Telegram: ${username1}\n` +
      `Уровень: ${user1.level}\n\n` +
      `Свяжись с партнёром и начните работу!`,
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Основная функция матчинга
 * Берёт пользователей из очереди и создаёт пары
 */
export async function runMatching(): Promise<{ pairsCreated: number }> {
  const waitingUsers = await getWaitingUsers();
  
  if (waitingUsers.length < 2) {
    return { pairsCreated: 0 };
  }

  let pairsCreated = 0;
  const matched = new Set<bigint>();

  // Простой алгоритм: проходим по списку и ищем совместимых пар
  for (let i = 0; i < waitingUsers.length; i++) {
    if (matched.has(waitingUsers[i].id)) continue;

    for (let j = i + 1; j < waitingUsers.length; j++) {
      if (matched.has(waitingUsers[j].id)) continue;

      const compatible = await areCompatible(waitingUsers[i], waitingUsers[j]);
      
      if (compatible) {
        await createPair(waitingUsers[i], waitingUsers[j]);
        matched.add(waitingUsers[i].id);
        matched.add(waitingUsers[j].id);
        pairsCreated++;
        break; // Переходим к следующему пользователю
      }
    }
  }

  return { pairsCreated };
}

/**
 * Проверяет и создаёт пары для конкретного пользователя
 * Используется сразу после входа в очередь
 */
export async function matchUser(userId: bigint): Promise<{ matched: boolean; partner?: MatchingQueueUser }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      username: true,
      displayName: true,
      level: true,
      rating: true,
    },
  });

  if (!user) {
    return { matched: false };
  }

  const waitingUsers = await getWaitingUsers();
  const userData = { ...user, rating: Number(user.rating) };

  for (const otherUser of waitingUsers) {
    if (otherUser.id === userId) continue;

    const compatible = await areCompatible(userData, otherUser);
    
    if (compatible) {
      await createPair(userData, otherUser);
      return { matched: true, partner: otherUser };
    }
  }

  return { matched: false };
}
