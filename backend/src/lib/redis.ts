import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Создаём Redis клиент если не в тестовом режиме и Redis не отключен явно
const shouldConnect = process.env.NODE_ENV !== 'test' && process.env.REDIS_AVAILABLE !== 'false';

export const redis = shouldConnect
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null, // BullMQ требует null
      enableReadyCheck: false,
    })
  : null;

if (shouldConnect && redis) {
  redis.on('connect', () => {
    console.log('Redis connected');
  });

  redis.on('error', (err: Error) => {
    console.error('Redis error:', err);
  });
} else {
  console.log('Redis disabled - running without Redis');
}

export default redis;

export function isRedisAvailable(client: Redis | null = redis): client is Redis {
  return client !== null;
}
