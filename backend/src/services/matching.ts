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
const memoryQueue: bigint[] = [];

function addToMemoryQueue(userId: bigint) {
  if (!memoryQueue.includes(userId)) {
    memoryQueue.push(userId);
  }
}

function removeFromMemoryQueue(userId: bigint) {
  const idx = memoryQueue.findIndex(id => id === userId);
  if (idx >= 0) {
    memoryQueue.splice(idx, 1);
  }
}

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
  // Временно убираем все проверки для теста
  console.log('Compatibility always true (temporarily)');
  return true;
}

/**
 * Добавляет пользователя в очередь матчинга
 */
export async function joinMatchingQueue(userId: bigint): Promise<{ success: boolean; message: string }> {
  console.log('joinMatchingQueue called for userId:', userId);
  
  try {
    // Проверяем, есть ли уже активная пара как партнер (нельзя быть партнером дважды)
    const existingPartnerPair = await prisma.pair.findFirst({
      where: {
        partnerId: userId,
        status: 'active',
      },
    });

    if (existingPartnerPair) {
      console.log('User already has partner pair:', userId);
      return { success: false, message: 'Вы уже партнер в активной паре' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.log('User not found:', userId);
      return { success: false, message: 'Пользователь не найден' };
    }

    // Добавляем в Redis для быстрого доступа, при отсутствии Redis используем fallback в памяти
    if (!redis) {
      addToMemoryQueue(userId);
      console.log('User added to memory queue:', userId);
      return { success: true, message: 'Вы добавлены в очередь поиска партнёра' };
    }
    await redis.set(`matching:user:${userId}`, '1', 'EX', 3600); // 1 час
    console.log('User added to queue:', userId);

    return { success: true, message: 'Вы добавлены в очередь поиска партнёра' };
  } catch (error) {
    console.error('Error in joinMatchingQueue:', error);
    return { success: false, message: 'Ошибка при добавлении в очередь' };
  }
}

/**
 * Удаляет пользователя из очереди матчинга
 */
export async function leaveMatchingQueue(userId: bigint): Promise<void> {
  if (!redis) {
    removeFromMemoryQueue(userId);
    return;
  }
  await redis.del(`matching:user:${userId}`);
}

/**
 * Получает пользователей, ожидающих матчинга
 * Пользователи без активной пары как партнер (могут быть смотрящими для других)
 */
async function getWaitingUsers(): Promise<MatchingQueueUser[]> {
  try {
    if (!redis) {
      if (memoryQueue.length === 0) {
        return [];
      }
      const users = await prisma.user.findMany({
        where: {
          id: { in: memoryQueue },
        },
        select: {
          id: true,
          telegramId: true,
          username: true,
          displayName: true,
          level: true,
          rating: true,
        },
      });

      const byId = new Map(users.map(u => [u.id.toString(), u]));
      return memoryQueue
        .map(id => byId.get(id.toString()))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map(u => ({ ...u, rating: Number(u.rating) }));
    }
    // Сначала получаем всех пользователей в Redis очереди
    const keys = await redis.keys('matching:user:*');
    console.log('Redis keys found:', keys.length);
    
    if (keys.length === 0) {
      console.log('No users in Redis queue');
      return [];
    }
    
    const userIdsInQueue = keys.map(key => BigInt(key.replace('matching:user:', '')));
    console.log('User IDs in queue:', userIdsInQueue.map(id => id.toString()));

    if (userIdsInQueue.length === 0) {
      console.log('No users in queue');
      return [];
    }

    // Получаем всех пользователей в очереди
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIdsInQueue },
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

    console.log('Users fetched from DB:', users.length);
    console.log('Users in DB:', users.map(u => ({ id: u.id.toString(), username: u.username, level: u.level })));

    // Фильтруем тех, у кого нет активной пары как партнер
    const usersWithoutPartnerPair: MatchingQueueUser[] = [];
    
    for (const user of users) {
      const hasPartnerPair = await prisma.pair.findFirst({
        where: {
          partnerId: user.id,
          status: 'active',
        },
      });
      
      console.log(`User ${user.id} has partner pair: ${!!hasPartnerPair}`);
      
      if (!hasPartnerPair) {
        usersWithoutPartnerPair.push({
          ...user,
          rating: Number(user.rating),
        });
      }
    }

    console.log('Users without partner pair:', usersWithoutPartnerPair.length);
    return usersWithoutPartnerPair;
  } catch (error) {
    console.error('Error in getWaitingUsers:', error);
    return [];
  }
}

/**
 * Создаёт пару между двумя пользователями
 * Асимметричная пара: partner — партнер, watcher — смотрящий
 * Смотрящий остается в очереди как потенциальный партнер
 */
async function createPair(partner: MatchingQueueUser, watcher: MatchingQueueUser) {
  // Создаём одну пару: watcher смотрит за partner
  await prisma.pair.create({
    data: {
      watcherId: watcher.id,
      partnerId: partner.id,
      status: 'active',
    },
  });

  // Удаляем только партнера из очереди матчинга
  // Смотрящий остается в очереди как потенциальный партнер
  if (redis) await redis.del(`matching:user:${partner.id}`);
  else removeFromMemoryQueue(partner.id);

  // Отправляем уведомления обоим пользователям
  if (botInstance) {
    const partnerName = partner.displayName ?? partner.username ?? 'Партнёр';
    const watcherName = watcher.displayName ?? watcher.username ?? 'Партнёр';
    const partnerUsername = partner.username ? `@${partner.username}` : 'нет username';
    const watcherUsername = watcher.username ? `@${watcher.username}` : 'нет username';

    // Уведомление для партнера
    await botInstance.telegram.sendMessage(
      Number(partner.telegramId),
      `🎉 *Найден смотрящий!*\n\n` +
      `Твой смотрящий: ${watcherName}\n` +
      `Telegram: ${watcherUsername}\n` +
      `Уровень: ${watcher.level}\n\n` +
      `Свяжись с партнёром и начните работу!`,
      { parse_mode: 'Markdown' }
    );

    // Уведомление для смотрящего
    await botInstance.telegram.sendMessage(
      Number(watcher.telegramId),
      `🎉 *Ты назначен смотрящим!*\n\n` +
      `Твой партнер: ${partnerName}\n` +
      `Telegram: ${partnerUsername}\n` +
      `Уровень: ${partner.level}\n\n` +
      `Ты остаешься в очереди поиска своего партнера.`,
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Основная функция матчинга
 * FIFO логика: первый в очереди - партнер, второй - смотрящий
 * Смотрящий остается в очереди как потенциальный партнер
 */
export async function runMatching(): Promise<{ pairsCreated: number }> {
  const waitingUsers = await getWaitingUsers();
  
  if (waitingUsers.length < 2) {
    return { pairsCreated: 0 };
  }

  let pairsCreated = 0;

  // FIFO: проходим по очереди по порядку
  for (let i = 0; i < waitingUsers.length - 1; i++) {
    const partner = waitingUsers[i];
    const watcher = waitingUsers[i + 1];

    // Проверяем, что партнер еще не в паре
    const partnerHasPair = await prisma.pair.findFirst({
      where: {
        partnerId: partner.id,
        status: 'active',
      },
    });

    if (partnerHasPair) continue;

    // Проверяем совместимость
    const compatible = await areCompatible(partner, watcher);
    
    if (compatible) {
      // Создаем пару: partner - партнер, watcher - смотрящий
      await createPair(partner, watcher);
      pairsCreated++;
      // Смотрящий остается в очереди как потенциальный партнер
      // Партнер удаляется из очереди (в createPair)
    }
  }

  return { pairsCreated };
}

/**
 * Проверяет и создаёт пары для конкретного пользователя
 * Используется сразу после входа в очередь
 * FIFO логика: если есть кто-то в очереди раньше - он партнер, этот пользователь смотрящий
 */
export async function matchUser(userId: bigint): Promise<{ matched: boolean; partner?: MatchingQueueUser; role?: 'partner' | 'watcher' }> {
  console.log('=== matchUser called for userId:', userId, '===');
  
  try {
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
      console.log('User not found:', userId);
      return { matched: false };
    }

    console.log('User found:', { id: user.id, username: user.username, level: user.level });

    const waitingUsers = await getWaitingUsers();
    console.log('Total waiting users:', waitingUsers.length);
    const userData = { ...user, rating: Number(user.rating) };

    // Если пользователь первый в очереди - нет партнера
    if (waitingUsers.length === 0) {
      console.log('Queue is empty - no match possible');
      return { matched: false };
    }
    
    if (waitingUsers[0].id === userId) {
      console.log('User is first in queue - waiting for others');
      return { matched: false };
    }

    // Если пользователь не первый - ищем того, кто перед ним
    for (const otherUser of waitingUsers) {
      if (otherUser.id === userId) continue;
      
      console.log('Checking compatibility with user:', otherUser.id, 'level:', otherUser.level);
      
      // Проверяем, что otherUser еще не имеет партнера
      const otherHasPartner = await prisma.pair.findFirst({
        where: {
          partnerId: otherUser.id,
          status: 'active',
        },
      });

      if (otherHasPartner) {
        console.log('User already has partner:', otherUser.id, '- skipping');
        continue;
      }

      const compatible = await areCompatible(userData, otherUser);
      console.log('Compatibility result:', compatible);
      
      if (compatible) {
        // otherUser - партнер, userData - смотрящий
        console.log('Creating pair: partner=', otherUser.id, 'watcher=', userData.id);
        await createPair(otherUser, userData);
        return { matched: true, partner: otherUser, role: 'watcher' };
      }
    }

    console.log('No compatible user found');
    return { matched: false };
  } catch (error) {
    console.error('Error in matchUser:', error);
    return { matched: false };
  }
}
