import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createBot } from './bot';
import { setBotInstance } from './services/matching';
import { setBotInstance as setReminderBotInstance, checkAndSendReminders } from './services/reminders';
import { enqueueDeadlineCheck, enqueueVotingClose } from './services/queue';
import './lib/sentry'; // Инициализация Sentry
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import goalsRouter from './routes/goals';
import pairsRouter from './routes/pairs';
import litRouter from './routes/lit';
import leaderboardRouter from './routes/leaderboard';
import votingRouter from './routes/voting';
import teachersRouter from './routes/teachers';
import reportsRouter from './routes/reports';
import uploadRouter from './routes/upload';
import tasksRouter from './routes/tasks';
import habitsRouter from './routes/habits';
import listingsRouter from './routes/listings';
import pairMessagesRouter from './routes/pair-messages';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const MINI_APP_URL = process.env.MINI_APP_URL ?? 'http://localhost:5173';

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    MINI_APP_URL,
    'https://stellular-haupia-9bddae.netlify.app',
    'https://list-frontend.onrender.com',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.headers['x-telegram-user-id'] as string ?? req.ip ?? 'unknown',
  message: { error: 'Too many requests' },
});
app.use('/api', limiter);

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/pairs', pairsRouter);
app.use('/api/lit', litRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/voting', votingRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/pair-messages', pairMessagesRouter);
app.use('/api/habits', habitsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken) {
    const bot = createBot(botToken, MINI_APP_URL);
    setBotInstance(bot); // Инициализируем бот для сервисов
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

    if (webhookUrl && process.env.NODE_ENV === 'production') {
      app.use(bot.webhookCallback('/webhook/telegram'));
      await bot.telegram.setWebhook(`${webhookUrl}/webhook/telegram`);
      console.log('Bot webhook set:', `${webhookUrl}/webhook/telegram`);
    } else {
      bot.launch();
      console.log('Bot started in polling mode');
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));
    }
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not set — bot disabled');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });

  // Крон: каждые 10 минут проверяем дедлайны и закрываем голосования
  setInterval(() => {
    enqueueDeadlineCheck().catch(console.error);
    enqueueVotingClose().catch(console.error);
  }, 10 * 60 * 1000);

  // Крон: каждую минуту проверяем и отправляем напоминания
  setInterval(() => {
    checkAndSendReminders().catch(console.error);
  }, 60 * 1000);
}

main().catch(console.error);
