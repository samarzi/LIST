import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL?.trim();
const redisEnabled = process.env.REDIS_AVAILABLE === 'true';

// Подключаем Redis только если он явно включён и URL задан
const shouldConnect = process.env.NODE_ENV !== 'test' && redisEnabled && !!redisUrl;

export const redis = shouldConnect
  ? new Redis(redisUrl!, {
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
