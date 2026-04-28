import { Telegraf, Markup } from 'telegraf';
import prisma from '../lib/prisma';

export function createBot(token: string, miniAppUrl: string) {
  const bot = new Telegraf(token);

  bot.start(async ctx => {
    const tgUser = ctx.from;
    if (!tgUser) return;

    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        username: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
      },
      create: {
        telegramId: BigInt(tgUser.id),
        username: tgUser.username ?? null,
        displayName: tgUser.first_name
          ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`
          : null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
      },
    });

    const name = user.displayName ?? user.firstName ?? 'друг';

    await ctx.reply(
      `👋 Привет, ${name}!\n\n` +
      `*LIST* — система взаимной поддержки в достижении целей.\n\n` +
      `🎯 Ставь цели и доказывай результат\n` +
      `👁 Следи за прогрессом партнёра\n` +
      `💰 Зарабатывай LIT за активность\n\n` +
      `Открой приложение, чтобы начать:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 Открыть LIST', miniAppUrl)],
        ]),
      }
    );
  });

  bot.command('goals', async ctx => {
    const tgUser = ctx.from;
    if (!tgUser) return;

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) } });
    if (!user) return ctx.reply('Сначала запусти бота командой /start');

    const goals = await prisma.goal.findMany({
      where: { userId: user.id, status: { in: ['in_progress', 'on_check', 'on_voting'] } },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    if (!goals.length) {
      return ctx.reply('У тебя нет активных целей. Открой приложение, чтобы добавить цель.', {
        ...Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть LIST', miniAppUrl)]]),
      });
    }

    const text = goals
      .map(g => {
        const days = Math.ceil((g.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const statusEmoji: Record<string, string> = {
          in_progress: '🔄',
          on_check: '🔍',
          on_voting: '🗳',
        };
        return `${statusEmoji[g.status] ?? '●'} *${g.title}*\n   ⏱ ${days > 0 ? `${days} дн.` : 'Просрочена'}`;
      })
      .join('\n\n');

    await ctx.reply(`*Твои активные цели:*\n\n${text}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.webApp('📱 Управлять целями', miniAppUrl)]]),
    });
  });

  bot.command('balance', async ctx => {
    const tgUser = ctx.from;
    if (!tgUser) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
      select: { litBalance: true, level: true, rating: true },
    });
    if (!user) return ctx.reply('Сначала запусти бота командой /start');

    await ctx.reply(
      `💰 *Твой баланс:* ${user.litBalance} LIT\n` +
      `⭐️ *Уровень:* ${user.level}\n` +
      `📊 *Рейтинг:* ${Number(user.rating).toFixed(1)}/5.0`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('partner', async ctx => {
    const tgUser = ctx.from;
    if (!tgUser) return;

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) } });
    if (!user) return ctx.reply('Сначала запусти бота командой /start');

    const pair = await prisma.pair.findFirst({
      where: { partnerId: user.id, status: 'active' },
      include: { watcher: { select: { username: true, displayName: true, level: true } } },
    });

    if (!pair) {
      return ctx.reply('У тебя пока нет смотрящего. Ты в очереди поиска партнёра.');
    }

    const watcher = pair.watcher;
    const name = watcher.displayName ?? watcher.username ?? 'Партнёр';
    const username = watcher.username ? `@${watcher.username}` : 'нет username';

    await ctx.reply(
      `👁 *Твой смотрящий:*\n\n` +
      `Имя: ${name}\n` +
      `Telegram: ${username}\n` +
      `Уровень: ${watcher.level}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('checkin', async ctx => {
    const tgUser = ctx.from;
    if (!tgUser) return;

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) } });
    if (!user) return ctx.reply('Сначала запусти бота командой /start');

    const activeGoal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'in_progress' },
      orderBy: { deadline: 'asc' },
    });

    if (!activeGoal) {
      return ctx.reply('У тебя нет активных целей для чекина. Создай цель в приложении.', {
        ...Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть LIST', miniAppUrl)]]),
      });
    }

    const content = ctx.message.text.replace('/checkin', '').trim();

    if (!content) {
      const days = Math.ceil((activeGoal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return ctx.reply(
        `📝 *Чекин по цели:*\n_${activeGoal.title}_\n\n` +
        `Напиши: /checkin <текст прогресса>\n\n` +
        `*Пример:* /checkin Сегодня сделал 30 отжиманий и 5 км бега\n\n` +
        `⏱ Осталось ${days > 0 ? `${days} дн.` : 'Просрочена'}`,
        { parse_mode: 'Markdown' }
      );
    }

    await prisma.checkin.create({
      data: {
        goalId: activeGoal.id,
        userId: user.id,
        content,
      },
    });

    const days = Math.ceil((activeGoal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await ctx.reply(
      `✅ *Чекин записан!*\n\n` +
      `_"${content}"_\n\n` +
      `Цель: *${activeGoal.title}*\n` +
      `Осталось: ${days > 0 ? `${days} дн.` : '⚠️ Просрочена'}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.webApp('📱 Посмотреть прогресс', miniAppUrl)]]),
      }
    );
  });

  bot.command('help', ctx => {
    ctx.reply(
      '*Команды LIST:*\n\n' +
      '/start — главное меню\n' +
      '/goals — мои активные цели\n' +
      '/checkin <текст> — быстрый чекин\n' +
      '/balance — баланс LIT\n' +
      '/partner — мой смотрящий\n' +
      '/help — помощь',
      { parse_mode: 'Markdown' }
    );
  });

  return bot;
}

// Функция для отправки уведомлений (вызывается из других частей системы)
export async function sendNotification(
  bot: Telegraf,
  telegramId: bigint,
  text: string,
  miniAppUrl?: string
) {
  try {
    const options = miniAppUrl
      ? {
          parse_mode: 'Markdown' as const,
          ...Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть', miniAppUrl)]]),
        }
      : { parse_mode: 'Markdown' as const };

    await bot.telegram.sendMessage(Number(telegramId), text, options);
  } catch (err) {
    console.error(`Failed to send notification to ${telegramId}:`, err);
  }
}
