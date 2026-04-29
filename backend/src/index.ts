import 'dotenv/config';

// Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err: Error) => {
  console.error('[uncaughtException]', err);
});

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
  skip: (req) => req.method === 'OPTIONS',
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

// Ping endpoint для поддержания активности
app.get('/ping', (_req, res) => {
  res.json({ 
    status: 'pong', 
    timestamp: new Date(),
    uptime: process.uptime()
  });
  console.log('Ping received - keeping service alive');
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const nodeEnv = process.env.NODE_ENV;

  console.log('=== Bot initialization ===');
  console.log('TELEGRAM_BOT_TOKEN exists:', !!botToken);
  console.log('TELEGRAM_WEBHOOK_URL:', webhookUrl);
  console.log('NODE_ENV:', nodeEnv);
  console.log('MINI_APP_URL:', MINI_APP_URL);

  if (botToken) {
    try {
      const bot = createBot(botToken, MINI_APP_URL);
      setBotInstance(bot); // Инициализируем бот для сервисов
      console.log('Bot instance created successfully');

      if (webhookUrl && nodeEnv === 'production') {
        app.use(bot.webhookCallback('/webhook/telegram'));
        await bot.telegram.setWebhook(webhookUrl + '/webhook/telegram');
        console.log('✅ Bot webhook set: ' + webhookUrl + '/webhook/telegram');
        
        // Verify webhook
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log('Webhook info:', webhookInfo);
      } else {
        console.log('⚠️ Webhook not configured properly:');
        console.log('  - webhookUrl:', webhookUrl ? 'set' : 'NOT SET');
        console.log('  - nodeEnv:', nodeEnv);
        console.log('Bot commands will NOT work!');
      }
    } catch (err) {
      console.error('❌ Failed to initialize bot:', err);
    }
  } else {
    console.warn('❌ TELEGRAM_BOT_TOKEN not set — bot disabled');
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
