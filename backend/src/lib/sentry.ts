import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

if (SENTRY_DSN && ENVIRONMENT === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: 0.1, // 10% транзакций для трассировки
    profilesSampleRate: 0.1, // 10% профилей
    beforeSend(event) {
      // Фильтруем чувствительные данные
      if (event.request) {
        delete event.request.headers;
        if (event.request.data) {
          // Удаляем пароли и токены
          const data = { ...event.request.data };
          delete data.password;
          delete data.token;
          delete data.jwt;
          event.request.data = data;
        }
      }
      return event;
    },
  });
  console.log('Sentry initialized');
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (SENTRY_DSN && ENVIRONMENT === 'production') {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('Error:', error, context);
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (SENTRY_DSN && ENVIRONMENT === 'production') {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[${level.toUpperCase()}]`, message);
  }
}

export default Sentry;
