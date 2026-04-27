import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { enqueueNotification } from './queue';

const INACTIVITY_THRESHOLD_DAYS = 3;
const INACTIVITY_THRESHOLD_MS = INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Проверяет активность пары
 * Возвращает true, если оба участника активны в последние 3 дня
 */
async function isPairActive(pairId: bigint): Promise<boolean> {
  const threeDaysAgo = new Date(Date.now() - INACTIVITY_THRESHOLD_MS);

  // Проверяем чекины
  const recentCheckins = await prisma.checkin.findFirst({
    where: {
      goal: { pairId },
      createdAt: { gte: threeDaysAgo },
    },
  });

  if (recentCheckins) return true;

  // Проверяем голосования
  const recentVotes = await prisma.vote.findFirst({
    where: {
      goal: { pairId },
      createdAt: { gte: threeDaysAgo },
    },
  });

  if (recentVotes) return true;

  // Проверяем подтверждения чекинов
  const recentConfirmations = await prisma.checkin.findFirst({
    where: {
      goal: { pairId },
      confirmedAt: { gte: threeDaysAgo },
    },
  });

  if (recentConfirmations) return true;

  return false;
}

/**
 * Находит неактивные пары
 */
export async function findInactivePairs(): Promise<Array<{ pairId: bigint; watcherId: bigint; studentId: bigint }>> {
  const pairs = await prisma.pair.findMany({
    where: { status: 'active' },
    select: { id: true, watcherId: true, studentId: true },
  });

  const inactivePairs: Array<{ pairId: bigint; watcherId: bigint; studentId: bigint }> = [];

  for (const pair of pairs) {
    const active = await isPairActive(pair.id);
    if (!active) {
      inactivePairs.push({
        pairId: pair.id,
        watcherId: pair.watcherId,
        studentId: pair.studentId,
      });
    }
  }

  return inactivePairs;
}

/**
 * Инициирует заморозку пары
 */
export async function initiateFreeze(
  pairId: bigint,
  initiatedBy: bigint,
  inactiveUserId: bigint
): Promise<void> {
  // Обновляем статус пары
  await prisma.pair.update({
    where: { id: pairId },
    data: {
      status: 'frozen',
      freezeInitiatedBy: initiatedBy,
    },
  });

  // Увеличиваем счётчик заморозок для неактивного пользователя
  const user = await prisma.user.findUnique({
    where: { id: inactiveUserId },
  });

  if (user) {
    const newFreezeCount = (user.freezeCount30d || 0) + 1;
    await prisma.user.update({
      where: { id: inactiveUserId },
      data: { freezeCount30d: newFreezeCount },
    });

    // Применяем штраф к рейтингу
    let ratingPenalty = 0;
    if (newFreezeCount === 2) {
      ratingPenalty = 0.05;
    } else if (newFreezeCount >= 3) {
      ratingPenalty = 0.15;
    }

    if (ratingPenalty > 0) {
      await prisma.user.update({
        where: { id: inactiveUserId },
        data: { rating: { decrement: ratingPenalty } },
      });
    }
  }

  // Отправляем уведомление неактивному пользователю
  const inactiveUser = await prisma.user.findUnique({
    where: { id: inactiveUserId },
  });

  if (inactiveUser) {
    await enqueueNotification(
      inactiveUser.telegramId,
      `⏳ *Твоя пара заморожена*\n\n` +
      `Твой партнёр не видел твоей активности 3 дня.\n\n` +
      `Вернись в приложение, чтобы восстановить пару.`,
    );
  }
}

/**
 * Размораживает пару
 */
export async function unfreezePair(pairId: bigint): Promise<void> {
  await prisma.pair.update({
    where: { id: pairId },
    data: { status: 'active', freezeInitiatedBy: null },
  });
}

/**
 * Заменяет партнёра в паре
 */
export async function replacePartner(
  pairId: bigint,
  inactiveUserId: bigint
): Promise<void> {
  // Завершаем текущую пару
  await prisma.pair.update({
    where: { id: pairId },
    data: { status: 'ended', endedAt: new Date() },
  });

  // Добавляем активного партнёра в очередь матчинга
  const pair = await prisma.pair.findUnique({
    where: { id: pairId },
  });

  if (pair) {
    const activeUserId = pair.watcherId === inactiveUserId ? pair.studentId : pair.watcherId;
    const { joinMatchingQueue } = await import('./matching');
    await joinMatchingQueue(activeUserId);
  }
}

/**
 * Проверяет все пары на неактивность
 * Должна запускаться по расписанию (cron)
 */
export async function checkAllPairsForInactivity(): Promise<{ checked: number; frozen: number }> {
  const inactivePairs = await findInactivePairs();
  let frozenCount = 0;

  for (const { pairId, watcherId, studentId } of inactivePairs) {
    // Проверяем, кто был активен последним
    const threeDaysAgo = new Date(Date.now() - INACTIVITY_THRESHOLD_MS);

    const [watcherActivity, studentActivity] = await Promise.all([
      prisma.checkin.findFirst({
        where: {
          goal: { pairId },
          userId: watcherId,
          createdAt: { gte: threeDaysAgo },
        },
      }),
      prisma.checkin.findFirst({
        where: {
          goal: { pairId },
          userId: studentId,
          createdAt: { gte: threeDaysAgo },
        },
      }),
    ]);

    // Определяем неактивного пользователя
    const inactiveUserId = watcherActivity ? studentId : studentActivity ? watcherId : studentId;
    const activeUserId = inactiveUserId === watcherId ? studentId : watcherId;

    // Отправляем уведомление активному партнёру
    const activeUser = await prisma.user.findUnique({
      where: { id: activeUserId },
    });

    if (activeUser) {
      await enqueueNotification(
        activeUser.telegramId,
        `⚠️ *Партнёр неактивен 3 дня*\n\n` +
        `Твой партнёр не выходил на связь 3 дня.\n\n` +
        `Выбери действие:\n` +
        `⏳ Ждать — партнёр будет заморожен\n` +
        `🔄 Заменить — найдём нового партнёра`,
      );

      // Сохраняем информацию о неактивности в Redis для обработки ответа
      await redis.setex(
        `inactivity:pair:${pairId}`,
        86400, // 24 часа
        JSON.stringify({ inactiveUserId, activeUserId })
      );
    }

    frozenCount++;
  }

  return { checked: inactivePairs.length, frozen: frozenCount };
}

/**
 * Обрабатывает решение активного партнёра
 */
export async function handleInactivityDecision(
  pairId: bigint,
  userId: bigint,
  decision: 'wait' | 'replace'
): Promise<{ success: boolean; message: string }> {
  const inactivityData = await redis.get(`inactivity:pair:${pairId}`);

  if (!inactivityData) {
    return { success: false, message: 'Срок действия истёк или пара уже обработана' };
  }

  const { inactiveUserId, activeUserId } = JSON.parse(inactivityData);

  if (userId !== activeUserId) {
    return { success: false, message: 'Только активный партнёр может принять решение' };
  }

  if (decision === 'wait') {
    await initiateFreeze(pairId, userId, inactiveUserId);
    await redis.del(`inactivity:pair:${pairId}`);
    return { success: true, message: 'Пара заморожена' };
  } else if (decision === 'replace') {
    await replacePartner(pairId, inactiveUserId);
    await redis.del(`inactivity:pair:${pairId}`);
    return { success: true, message: 'Поиск нового партнёра начат' };
  }

  return { success: false, message: 'Неверное решение' };
}

/**
 * Позволяет замороженному пользователю вернуться
 */
export async function returnFromFreeze(userId: bigint): Promise<{ success: boolean; message: string }> {
  // Находим замороженную пару пользователя
  const pair = await prisma.pair.findFirst({
    where: {
      OR: [
        { watcherId: userId, status: 'frozen' },
        { studentId: userId, status: 'frozen' },
      ],
    },
  });

  if (!pair) {
    return { success: false, message: 'Нет замороженных пар' };
  }

  // Размораживаем пару
  await unfreezePair(pair.id);

  // Отправляем уведомление партнёру
  const partnerId = pair.watcherId === userId ? pair.studentId : pair.watcherId;
  const partner = await prisma.user.findUnique({
    where: { id: partnerId },
  });

  if (partner) {
    await enqueueNotification(
      partner.telegramId,
      `✅ *Партнёр вернулся!*\n\n` +
      `Твой партнёр снова активен. Пара восстановлена.`,
    );
  }

  return { success: true, message: 'Пара восстановлена' };
}
