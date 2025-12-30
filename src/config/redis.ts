// =============================================================================
// MessageWise Optimizer - Redis Configuration
// =============================================================================

import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

let redisClient: RedisClientType | null = null;
let redisAvailable = false;

/**
 * Get or create Redis client instance
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!redisAvailable) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            redisAvailable = false;
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 1000);
        },
      },
    });

    redisClient.on('error', () => {
      // Suppress repeated error logs
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      redisAvailable = true;
    });
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Connect to Redis
 */
export async function connectRedis(): Promise<void> {
  try {
    redisAvailable = true; // Enable first attempt
    const client = await getRedisClient();
    if (client) {
      await client.ping();
      logger.info('Redis connection verified');
    }
  } catch (error) {
    redisAvailable = false;
    logger.warn('Redis connection failed - caching disabled');
    throw error;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// =============================================================================
// Cache Utilities
// =============================================================================

const DEFAULT_TTL = 3600; // 1 hour in seconds

/**
 * Set a value in cache
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    const serialized = JSON.stringify(value);
    await client.setEx(key, ttl, serialized);
  } catch {
    // Silently fail if Redis is unavailable
  }
}

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;
    const value = await client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Delete a key from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    await client.del(key);
  } catch {
    // Silently fail
  }
}

/**
 * Delete keys matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch {
    // Silently fail
  }
}

/**
 * Get or set cache value (cache-aside pattern)
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);

  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  await cacheSet(key, value, ttl);

  return value;
}

/**
 * Increment a counter in cache
 */
export async function cacheIncrement(key: string, ttl?: number): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client) return 1; // Return 1 if Redis unavailable
    const value = await client.incr(key);

    if (ttl && value === 1) {
      await client.expire(key, ttl);
    }

    return value;
  } catch {
    return 1;
  }
}

// =============================================================================
// Cache Key Builders
// =============================================================================

export const CacheKeys = {
  // User cache keys
  user: (userId: string) => `user:${userId}`,
  userByEmail: (email: string) => `user:email:${email}`,
  userSession: (token: string) => `session:${token}`,

  // Account cache keys
  account: (accountId: string) => `account:${accountId}`,
  accountsByUser: (userId: string) => `accounts:user:${userId}`,

  // Analytics cache keys
  analyticsSummary: (accountId: string, period: string) =>
    `analytics:${accountId}:${period}`,
  costBreakdown: (accountId: string, period: string) =>
    `cost:${accountId}:${period}`,

  // Rate limiting keys
  rateLimit: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
  apiKeyRate: (keyId: string) => `ratelimit:apikey:${keyId}`,

  // Webhook deduplication
  webhookDedup: (messageId: string) => `webhook:dedup:${messageId}`,
};

export default {
  getRedisClient,
  connectRedis,
  disconnectRedis,
  checkRedisHealth,
  cacheSet,
  cacheGet,
  cacheDelete,
  cacheDeletePattern,
  cacheGetOrSet,
  cacheIncrement,
  CacheKeys,
};
