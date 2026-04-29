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

async function getExcludedUserIdsForPartner(userId: bigint): Promise<bigint[]> {
  const activePairs = await prisma.pair.findMany({
    where: {
      OR: [{ partnerId: userId }, { watcherId: userId }],
      status: 'active',
    },
    select: { partnerId: true, watcherId: true },
  });

  const excluded = new Set<bigint>([userId]);
  for (const pair of activePairs) {
    excluded.add(pair.partnerId);
    excluded.add(pair.watcherId);
  }
  return Array.from(excluded);
}

async function findWatcherCandidateForUser(user: MatchingQueueUser): Promise<MatchingQueueUser | null> {
  console.log('=== findWatcherCandidateForUser called ===');
  console.log('Looking for watcher for user:', user.id.toString(), 'username:', user.username);
  
  const excludedIds = await getExcludedUserIdsForPartner(user.id);
  console.log('Excluded IDs:', excludedIds.map(id => id.toString()));
  
  const waitingUsers = await getWaitingUsers();
  console.log('Waiting users count:', waitingUsers.length);
  console.log('Waiting users:', waitingUsers.map(u => ({ id: u.id.toString(), username: u.username })));

  for (const candidate of waitingUsers) {
    console.log('Checking candidate:', candidate.id.toString(), 'username:', candidate.username);
    
    if (excludedIds.includes(candidate.id)) {
      console.log('  -> Skipped: in excluded list');
      continue;
    }

    const pairExists = await prisma.pair.findFirst({
      where: {
        partnerId: user.id,
        watcherId: candidate.id,
        status: 'active',
      },
    });
    if (pairExists) {
      console.log('  -> Skipped: pair already exists');
      continue;
    }

    const compatible = await areCompatible(user, candidate);
    console.log('  -> Compatible:', compatible);
    if (compatible) {
      console.log('  -> FOUND MATCH!');
      return candidate;
    }
  }
  console.log('No candidate found in waiting users');

  // Fallback: подбираем любого зарегистрированного пользователя, не из исключений
  console.log('Trying fallback: searching DB for any available user...');
  const dbUsers = await prisma.user.findMany({
    where: {
      id: { notIn: excludedIds },
    },
    select: {
      id: true,
      telegramId: true,
      username: true,
      displayName: true,
      level: true,
      rating: true,
    },
    take: 50,
  });
  console.log('DB users found (excluding self):', dbUsers.length);

  for (const candidate of dbUsers) {
    console.log('Checking DB candidate:', candidate.id.toString());
    const pairExists = await prisma.pair.findFirst({
      where: {
        partnerId: user.id,
        watcherId: candidate.id,
        status: 'active',
      },
    });
    if (pairExists) {
      console.log('  -> Skipped: pair exists');
      continue;
    }

    const candidateNormalized: MatchingQueueUser = { ...candidate, rating: Number(candidate.rating) };
    const compatible = await areCompatible(user, candidateNormalized);
    console.log('  -> Compatible:', compatible);
    if (compatible) {
      console.log('  -> FOUND MATCH in fallback!');
      return candidateNormalized;
    }
  }

  console.log('No watcher candidate found at all');
  return null;
}

/**
 * Добавляет пользователя в очередь матчинга
 */
export async function joinMatchingQueue(userId: bigint): Promise<{ success: boolean; message: string }> {
  console.log('joinMatchingQueue called for userId:', userId);
  
  try {
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
      console.log('User added to memory queue:', userId.toString());
      console.log('Memory queue now has:', memoryQueue.length, 'users');
      return { success: true, message: 'Вы добавлены в очередь поиска партнёра' };
    }
    await redis.set(`matching:user:${userId}`, '1', 'EX', 3600); // 1 час
    console.log('User added to Redis queue:', userId.toString());

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
      console.log('=== getWaitingUsers (memory mode) ===');
      console.log('Memory queue raw:', memoryQueue.map(id => id.toString()));
      console.log('Memory queue size:', memoryQueue.length);
      if (memoryQueue.length === 0) {
        console.log('Memory queue is empty, returning []');
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
      const queueUsers = memoryQueue
        .map(id => byId.get(id.toString()))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map(u => ({ ...u, rating: Number(u.rating) }));
      
      console.log('Memory queue users loaded:', queueUsers.length);
      console.log('Queue users details:', queueUsers.map(u => ({ id: u.id.toString(), username: u.username })));
      return queueUsers;
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
    const allQueueUsers: MatchingQueueUser[] = users.map(u => ({ ...u, rating: Number(u.rating) }));
    console.log('All queue users:', allQueueUsers.length);
    return allQueueUsers;
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
  console.log('=== createPair called ===');
  console.log('Partner:', partner.id.toString(), 'Watcher:', watcher.id.toString());
  
  // Создаём одну пару: watcher смотрит за partner
  const pair = await prisma.pair.create({
    data: {
      watcherId: watcher.id,
      partnerId: partner.id,
      status: 'active',
    },
  });
  console.log('Pair created in DB:', pair.id.toString());

  // Удаляем только партнера из очереди матчинга
  // Смотрящий остается в очереди как потенциальный партнер
  if (redis) {
    await redis.del(`matching:user:${partner.id}`);
    console.log('Partner removed from Redis queue');
  } else {
    removeFromMemoryQueue(partner.id);
    console.log('Partner removed from memory queue');
  }

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

  // FIFO: проходим по очереди, для каждого подбираем валидного смотрящего
  for (const partner of waitingUsers) {
    // Пропускаем тех, у кого уже есть смотрящий — они в очереди как потенциальные смотрящие
    const partnerHasPair = await prisma.pair.findFirst({
      where: { partnerId: partner.id, status: 'active' },
    });
    if (partnerHasPair) continue;

    const watcher = await findWatcherCandidateForUser(partner);
    if (!watcher) continue;

    // Создаем пару: partner - партнер, watcher - смотрящий
    await createPair(partner, watcher);
    pairsCreated++;
    // Смотрящий остается в очереди как потенциальный партнер
    // Партнер удаляется из очереди (в createPair)
  }

  return { pairsCreated };
}

/**
 * Проверяет и создаёт пары для конкретного пользователя
 * Используется сразу после входа в очередь
 * FIFO логика: если есть кто-то в очереди раньше - он партнер, этот пользователь смотрящий
 */
export async function matchUser(userId: bigint): Promise<{ matched: boolean; partner?: MatchingQueueUser; role?: 'partner' | 'watcher' }> {
  console.log('=== matchUser called for userId:', userId.toString(), '===');
  
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
      console.log('User not found:', userId.toString());
      return { matched: false };
    }

    console.log('User found:', { id: user.id.toString(), username: user.username, level: user.level });

    const userData = { ...user, rating: Number(user.rating) };

    // If user already has a watcher, try to match them AS a watcher for someone else
    const alreadyPartner = await prisma.pair.findFirst({
      where: { partnerId: userId, status: 'active' },
    });
    if (alreadyPartner) {
      console.log('User already has a watcher — trying to match them as a watcher for someone');
      return matchUserAsWatcher(userData);
    }

    const candidate = await findWatcherCandidateForUser(userData);
    if (!candidate) {
      console.log('No compatible user found for:', userId.toString());
      return { matched: false };
    }

    console.log('Creating pair: partner=', userData.id.toString(), 'watcher=', candidate.id.toString());
    await createPair(userData, candidate);
    return { matched: true, partner: candidate, role: 'partner' };
  } catch (error) {
    console.error('Error in matchUser:', error);
    return { matched: false };
  }
}

/**
 * Matches a user as a watcher for someone who doesn't have one yet.
 * Uses batch queries to avoid N+1 loops.
 */
async function matchUserAsWatcher(
  watcher: MatchingQueueUser,
): Promise<{ matched: boolean; partner?: MatchingQueueUser }> {
  console.log('=== matchUserAsWatcher called for:', watcher.id.toString(), '===');

  // 1. Find all users already paired with this watcher (exclude them)
  const existingPairs = await prisma.pair.findMany({
    where: { watcherId: watcher.id, status: 'active' },
    select: { partnerId: true },
  });
  const alreadyWatching = new Set(existingPairs.map(p => p.partnerId));

  // 2. Find all users who already have any active watcher
  const pairedAsPartner = await prisma.pair.findMany({
    where: { status: 'active' },
    select: { partnerId: true },
  });
  const hasWatcher = new Set(pairedAsPartner.map(p => p.partnerId));

  // 3. Find first eligible user: not watcher themselves, no watcher yet, not already watched by this watcher
  const candidate = await prisma.user.findFirst({
    where: {
      id: {
        not: watcher.id,
        notIn: [
          ...Array.from(alreadyWatching),
          ...Array.from(hasWatcher),
        ],
      },
    },
    select: { id: true, telegramId: true, username: true, displayName: true, level: true, rating: true },
  });

  if (!candidate) {
    console.log('matchUserAsWatcher: no suitable partner found');
    return { matched: false };
  }

  const partnerData: MatchingQueueUser = { ...candidate, rating: Number(candidate.rating) };
  console.log('matchUserAsWatcher: creating pair partner=', candidate.id.toString(), 'watcher=', watcher.id.toString());
  await createPair(partnerData, watcher);
  return { matched: true, partner: partnerData };
}
