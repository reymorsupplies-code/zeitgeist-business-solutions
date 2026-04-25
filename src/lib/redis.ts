/**
 * Redis Client Singleton for ZBS
 *
 * Provides a Redis connection for session management, caching, and real-time features.
 * Falls back gracefully if REDIS_URL is not configured.
 */

import Redis from 'ioredis';

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not configured — Redis features disabled');
    return null;
  }

  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 5000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
    });

    _redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    _redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    return _redis;
  } catch (error) {
    console.error('[Redis] Failed to create client:', error);
    return null;
  }
}

/**
 * Safely get a value from Redis. Returns null if Redis is not available.
 */
export async function redisGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

/**
 * Safely set a value in Redis with optional TTL.
 */
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, value);
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely delete a key from Redis.
 */
export async function redisDel(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.del(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely get JSON from Redis.
 */
export async function redisGetJSON<T = any>(key: string): Promise<T | null> {
  const raw = await redisGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Safely set JSON to Redis with optional TTL.
 */
export async function redisSetJSON(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
  return redisSet(key, JSON.stringify(value), ttlSeconds);
}
