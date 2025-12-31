import { RedisClientType } from 'redis';
/**
 * Get or create Redis client instance
 */
export declare function getRedisClient(): Promise<RedisClientType | null>;
/**
 * Connect to Redis
 */
export declare function connectRedis(): Promise<void>;
/**
 * Disconnect from Redis
 */
export declare function disconnectRedis(): Promise<void>;
/**
 * Health check for Redis
 */
export declare function checkRedisHealth(): Promise<boolean>;
/**
 * Set a value in cache
 */
export declare function cacheSet(key: string, value: unknown, ttl?: number): Promise<void>;
/**
 * Get a value from cache
 */
export declare function cacheGet<T>(key: string): Promise<T | null>;
/**
 * Delete a key from cache
 */
export declare function cacheDelete(key: string): Promise<void>;
/**
 * Delete keys matching a pattern
 */
export declare function cacheDeletePattern(pattern: string): Promise<void>;
/**
 * Get or set cache value (cache-aside pattern)
 */
export declare function cacheGetOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>;
/**
 * Increment a counter in cache
 */
export declare function cacheIncrement(key: string, ttl?: number): Promise<number>;
export declare const CacheKeys: {
    user: (userId: string) => string;
    userByEmail: (email: string) => string;
    userSession: (token: string) => string;
    account: (accountId: string) => string;
    accountsByUser: (userId: string) => string;
    analyticsSummary: (accountId: string, period: string) => string;
    costBreakdown: (accountId: string, period: string) => string;
    rateLimit: (ip: string, endpoint: string) => string;
    apiKeyRate: (keyId: string) => string;
    webhookDedup: (messageId: string) => string;
};
declare const _default: {
    getRedisClient: typeof getRedisClient;
    connectRedis: typeof connectRedis;
    disconnectRedis: typeof disconnectRedis;
    checkRedisHealth: typeof checkRedisHealth;
    cacheSet: typeof cacheSet;
    cacheGet: typeof cacheGet;
    cacheDelete: typeof cacheDelete;
    cacheDeletePattern: typeof cacheDeletePattern;
    cacheGetOrSet: typeof cacheGetOrSet;
    cacheIncrement: typeof cacheIncrement;
    CacheKeys: {
        user: (userId: string) => string;
        userByEmail: (email: string) => string;
        userSession: (token: string) => string;
        account: (accountId: string) => string;
        accountsByUser: (userId: string) => string;
        analyticsSummary: (accountId: string, period: string) => string;
        costBreakdown: (accountId: string, period: string) => string;
        rateLimit: (ip: string, endpoint: string) => string;
        apiKeyRate: (keyId: string) => string;
        webhookDedup: (messageId: string) => string;
    };
};
export default _default;
//# sourceMappingURL=redis.d.ts.map