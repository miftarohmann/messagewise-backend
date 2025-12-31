"use strict";
// =============================================================================
// MessageWise Optimizer - Redis Configuration
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKeys = void 0;
exports.getRedisClient = getRedisClient;
exports.connectRedis = connectRedis;
exports.disconnectRedis = disconnectRedis;
exports.checkRedisHealth = checkRedisHealth;
exports.cacheSet = cacheSet;
exports.cacheGet = cacheGet;
exports.cacheDelete = cacheDelete;
exports.cacheDeletePattern = cacheDeletePattern;
exports.cacheGetOrSet = cacheGetOrSet;
exports.cacheIncrement = cacheIncrement;
const redis_1 = require("redis");
const logger_1 = __importDefault(require("../utils/logger"));
let redisClient = null;
let redisAvailable = false;
/**
 * Get or create Redis client instance
 */
async function getRedisClient() {
    if (!redisAvailable) {
        return null;
    }
    if (!redisClient) {
        redisClient = (0, redis_1.createClient)({
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
            logger_1.default.info('Redis client connected');
        });
        redisClient.on('ready', () => {
            logger_1.default.info('Redis client ready');
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
async function connectRedis() {
    try {
        redisAvailable = true; // Enable first attempt
        const client = await getRedisClient();
        if (client) {
            await client.ping();
            logger_1.default.info('Redis connection verified');
        }
    }
    catch (error) {
        redisAvailable = false;
        logger_1.default.warn('Redis connection failed - caching disabled');
        throw error;
    }
}
/**
 * Disconnect from Redis
 */
async function disconnectRedis() {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        logger_1.default.info('Redis disconnected');
    }
}
/**
 * Health check for Redis
 */
async function checkRedisHealth() {
    try {
        if (!redisClient || !redisClient.isOpen) {
            return false;
        }
        const result = await redisClient.ping();
        return result === 'PONG';
    }
    catch {
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
async function cacheSet(key, value, ttl = DEFAULT_TTL) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        const serialized = JSON.stringify(value);
        await client.setEx(key, ttl, serialized);
    }
    catch {
        // Silently fail if Redis is unavailable
    }
}
/**
 * Get a value from cache
 */
async function cacheGet(key) {
    try {
        const client = await getRedisClient();
        if (!client)
            return null;
        const value = await client.get(key);
        if (!value) {
            return null;
        }
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
/**
 * Delete a key from cache
 */
async function cacheDelete(key) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        await client.del(key);
    }
    catch {
        // Silently fail
    }
}
/**
 * Delete keys matching a pattern
 */
async function cacheDeletePattern(pattern) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
        }
    }
    catch {
        // Silently fail
    }
}
/**
 * Get or set cache value (cache-aside pattern)
 */
async function cacheGetOrSet(key, fetchFn, ttl = DEFAULT_TTL) {
    const cached = await cacheGet(key);
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
async function cacheIncrement(key, ttl) {
    try {
        const client = await getRedisClient();
        if (!client)
            return 1; // Return 1 if Redis unavailable
        const value = await client.incr(key);
        if (ttl && value === 1) {
            await client.expire(key, ttl);
        }
        return value;
    }
    catch {
        return 1;
    }
}
// =============================================================================
// Cache Key Builders
// =============================================================================
exports.CacheKeys = {
    // User cache keys
    user: (userId) => `user:${userId}`,
    userByEmail: (email) => `user:email:${email}`,
    userSession: (token) => `session:${token}`,
    // Account cache keys
    account: (accountId) => `account:${accountId}`,
    accountsByUser: (userId) => `accounts:user:${userId}`,
    // Analytics cache keys
    analyticsSummary: (accountId, period) => `analytics:${accountId}:${period}`,
    costBreakdown: (accountId, period) => `cost:${accountId}:${period}`,
    // Rate limiting keys
    rateLimit: (ip, endpoint) => `ratelimit:${ip}:${endpoint}`,
    apiKeyRate: (keyId) => `ratelimit:apikey:${keyId}`,
    // Webhook deduplication
    webhookDedup: (messageId) => `webhook:dedup:${messageId}`,
};
exports.default = {
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
    CacheKeys: exports.CacheKeys,
};
//# sourceMappingURL=redis.js.map