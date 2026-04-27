import { Queue, Worker, Job } from 'bullmq';
import redis from '../lib/redis';
import prisma from '../lib/prisma';

// Проверяем доступность Redis
const isRedisAvailable = redis !== null;

// Очереди создаются только если Redis доступен
export const matchingQueue = isRedisAvailable ? new Queue('matching', { connection: redis }) : null;
export const notificationsQueue = isRedisAvailable ? new Queue('notifications', { connection: redis }) : null;
export const deadlinesQueue = isRedisAvailable ? new Queue('deadlines', { connection: redis }) : null;
export const litQueue = isRedisAvailable ? new Queue('lit', { connection: redis }) : null;

/**
 * Воркер для обработки матчинга
 */
export const matchingWorker = isRedisAvailable ? new Worker(
  'matching',
  async (job: Job) => {
    const { userId } = job.data as { userId?: bigint };

    // Если указан конкретный пользователь - матчим только его
    if (userId) {
      const { matchUser } = await import('./matching');
      await matchUser(userId);
    } else {
      // Иначе запускаем полное матчинг
      const { runMatching } = await import('./matching');
      await runMatching();
    }
  },
  { connection: redis }
) : null;

/**
 * Воркер для отправки уведомлений
 */
export const notificationsWorker = isRedisAvailable ? new Worker(
  'notifications',
  async (job: Job) => {
    const { telegramId, text, miniAppUrl } = job.data as {
      telegramId: bigint;
      text: string;
      miniAppUrl?: string;
    };

    const { sendNotification } = await import('../bot');
    const { createBot } = await import('../bot');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const miniAppUrlDefault = process.env.MINI_APP_URL ?? 'http://localhost:5173';

    if (botToken) {
      const bot = createBot(botToken, miniAppUrlDefault);
      await sendNotification(bot, telegramId, text, miniAppUrl);
    }
  },
  { connection: redis }
) : null;

/**
 * Воркер для проверки дедлайнов
 */
export const deadlinesWorker = isRedisAvailable ? new Worker(
  'deadlines',
  async (job: Job) => {
    // Находим цели с истёкшим дедлайном
    const expiredGoals = await prisma.goal.findMany({
      where: {
        deadline: { lt: new Date() },
        status: 'in_progress',
      },
      include: { user: true, pair: true },
    });

    for (const goal of expiredGoals) {
      // Помечаем цель как не выполненную
      await prisma.goal.update({
        where: { id: goal.id },
        data: { status: 'not_completed', completedAt: new Date() },
      });

      // Обновляем статистику пользователя
      await prisma.user.update({
        where: { id: goal.userId },
        data: {
          totalGoalsFailed: { increment: 1 },
          rating: { decrement: 0.1 },
        },
      });

      // Отправляем уведомление
      if (notificationsQueue) {
        await notificationsQueue.add('deadline-expired', {
          telegramId: goal.user.telegramId,
          text: `⏰ *Дедлайн истёк!*\n\nЦель "${goal.title}" не выполнена вовремя.\n\nРейтинг уменьшен на 0.1.`,
        });
      }
    }
  },
  { connection: redis }
) : null;

/**
 * Воркер для расчёта LIT
 */
export const litWorker = isRedisAvailable ? new Worker(
  'lit',
  async (job: Job) => {
    const { goalId, medianGoal, medianWatcher } = job.data as {
      goalId: bigint;
      medianGoal: number;
      medianWatcher: number;
    };

    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { user: true, pair: true },
    });

    if (!goal) return;

    // Определяем коэффициент сложности
    const difficulty = goal.difficulty || 5;
    let difficultyMultiplier = 1;
    if (difficulty >= 1 && difficulty <= 3) difficultyMultiplier = 1;
    else if (difficulty >= 4 && difficulty <= 6) difficultyMultiplier = 3;
    else if (difficulty >= 7 && difficulty <= 9) difficultyMultiplier = 8;
    else if (difficulty === 10) difficultyMultiplier = 20;

    // Начисляем LIT ученику
    const studentLit = Math.round(medianGoal * difficultyMultiplier * 0.6);
    await prisma.user.update({
      where: { id: goal.userId },
      data: { litBalance: { increment: studentLit } },
    });

    // Записываем транзакцию
    await prisma.litTransaction.create({
      data: {
        userId: goal.userId,
        amount: studentLit,
        type: 'goal_completed',
        relatedId: goalId,
        note: `Цель выполнена с оценкой ${medianGoal}`,
      },
    });

    // Начисляем LIT смотрящему
    if (goal.pair) {
      const watcherLit = Math.round(medianWatcher * difficultyMultiplier * 0.3);
      await prisma.user.update({
        where: { id: goal.pair.watcherId },
        data: { litBalance: { increment: watcherLit } },
      });

      await prisma.litTransaction.create({
        data: {
          userId: goal.pair.watcherId,
          amount: watcherLit,
          type: 'watcher_reward',
          relatedId: goalId,
          note: `Награда за смотрящего с оценкой ${medianWatcher}`,
        },
      });
    }
  },
  { connection: redis }
) : null;

// Обработка ошибок воркеров
if (matchingWorker) matchingWorker.on('error', (err: Error) => console.error('Matching worker error:', err));
if (notificationsWorker) notificationsWorker.on('error', (err: Error) => console.error('Notifications worker error:', err));
if (deadlinesWorker) deadlinesWorker.on('error', (err: Error) => console.error('Deadlines worker error:', err));
if (litWorker) litWorker.on('error', (err: Error) => console.error('LIT worker error:', err));

/**
 * Добавляет задачу на матчинг для конкретного пользователя
 */
export async function enqueueMatching(userId: bigint) {
  if (!matchingQueue) return;
  await matchingQueue.add('match-user', { userId }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
}

/**
 * Добавляет задачу на полное матчинг
 */
export async function enqueueFullMatching() {
  if (!matchingQueue) return;
  await matchingQueue.add('full-matching', {}, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
}

/**
 * Добавляет задачу на отправку уведомления
 */
export async function enqueueNotification(telegramId: bigint, text: string, miniAppUrl?: string) {
  if (!notificationsQueue) return;
  await notificationsQueue.add('send-notification', { telegramId, text, miniAppUrl }, { attempts: 5, backoff: { type: 'exponential', delay: 2000 } });
}

/**
 * Добавляет задачу на проверку дедлайнов
 */
export async function enqueueDeadlineCheck() {
  if (!deadlinesQueue) return;
  await deadlinesQueue.add('check-deadlines', {}, { attempts: 3 });
}

/**
 * Добавляет задачу на расчёт LIT
 */
export async function enqueueLitCalculation(goalId: bigint, medianGoal: number, medianWatcher: number) {
  if (!litQueue) return;
  await litQueue.add('calculate-lit', { goalId, medianGoal, medianWatcher }, { attempts: 3 });
}
