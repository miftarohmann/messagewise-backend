"use strict";
// =============================================================================
// MessageWise Optimizer - Rate Limiting Middleware
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisRateLimiter = exports.reportRateLimiter = exports.webhookRateLimiter = exports.strictRateLimiter = exports.standardRateLimiter = void 0;
exports.planBasedRateLimiter = planBasedRateLimiter;
exports.apiKeyRateLimiter = apiKeyRateLimiter;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("../config/redis");
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Standard rate limiter using express-rate-limit
 * For general API endpoints
 */
exports.standardRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
            message: 'Too many requests. Please try again later.',
        },
    },
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise use IP
        const authReq = req;
        return authReq.user?.userId || req.ip || 'unknown';
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
    },
});
/**
 * Strict rate limiter for sensitive endpoints
 * Authentication, registration, password reset
 */
exports.strictRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 100 : 20, // Higher limit in dev
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
            message: 'Too many attempts. Please try again later.',
        },
    },
    keyGenerator: (req) => {
        return req.ip || 'unknown';
    },
    skip: () => process.env.NODE_ENV === 'development', // Skip in development
});
/**
 * Webhook rate limiter
 * Higher limits for incoming webhooks
 */
exports.webhookRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
            message: 'Webhook rate limit exceeded.',
        },
    },
    keyGenerator: (req) => {
        // Key by account ID from path or IP
        const accountId = req.params.accountId || req.ip;
        return `webhook:${accountId}`;
    },
});
/**
 * Plan-based rate limiter middleware
 * Applies different limits based on user's subscription plan
 */
async function planBasedRateLimiter(req, res, next) {
    try {
        const user = req.user;
        if (!user) {
            // Apply free tier limits for unauthenticated requests
            return applyRateLimit(req, res, next, constants_1.RATE_LIMITS.FREE);
        }
        // Get rate limits for user's plan
        const limits = constants_1.RATE_LIMITS[user.plan] || constants_1.RATE_LIMITS.FREE;
        return applyRateLimit(req, res, next, limits);
    }
    catch (error) {
        logger_1.default.error('Rate limiter error', { error });
        // On error, allow the request through
        next();
    }
}
/**
 * Apply rate limit using Redis
 */
async function applyRateLimit(req, res, next, limits) {
    const key = redis_1.CacheKeys.rateLimit(req.user?.userId || req.ip || 'unknown', req.path);
    const ttlSeconds = Math.ceil(limits.windowMs / 1000);
    const currentCount = await (0, redis_1.cacheIncrement)(key, ttlSeconds);
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limits.requestsPerWindow);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.requestsPerWindow - currentCount));
    if (currentCount > limits.requestsPerWindow) {
        res.setHeader('Retry-After', Math.ceil(limits.windowMs / 1000));
        res.status(429).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
                message: 'Rate limit exceeded. Please upgrade your plan for higher limits.',
            },
        });
        return;
    }
    next();
}
/**
 * API Key rate limiter
 * Separate rate limits for API key usage
 */
async function apiKeyRateLimiter(req, res, next) {
    if (!req.apiKey) {
        next();
        return;
    }
    try {
        const limits = constants_1.RATE_LIMITS[req.user?.plan] || constants_1.RATE_LIMITS.FREE;
        const key = redis_1.CacheKeys.apiKeyRate(req.apiKey.keyId);
        const ttlSeconds = Math.ceil(limits.windowMs / 1000);
        const currentCount = await (0, redis_1.cacheIncrement)(key, ttlSeconds);
        res.setHeader('X-RateLimit-Limit', limits.requestsPerWindow);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.requestsPerWindow - currentCount));
        if (currentCount > limits.requestsPerWindow) {
            res.status(429).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
                    message: 'API key rate limit exceeded.',
                },
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.default.error('API key rate limiter error', { error });
        next();
    }
}
/**
 * Report generation rate limiter
 * Limit expensive operations
 */
exports.reportRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 reports per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
            message: 'Report generation rate limit exceeded. Try again later.',
        },
    },
    keyGenerator: (req) => {
        const authReq = req;
        return `report:${authReq.user?.userId || req.ip}`;
    },
});
/**
 * Cost analysis rate limiter
 * Limit expensive analysis operations
 */
exports.analysisRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // 30 analyses per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
            message: 'Analysis rate limit exceeded. Please wait a moment.',
        },
    },
    keyGenerator: (req) => {
        const authReq = req;
        return `analysis:${authReq.user?.userId || req.ip}`;
    },
});
exports.default = {
    standardRateLimiter: exports.standardRateLimiter,
    strictRateLimiter: exports.strictRateLimiter,
    webhookRateLimiter: exports.webhookRateLimiter,
    planBasedRateLimiter,
    apiKeyRateLimiter,
    reportRateLimiter: exports.reportRateLimiter,
    analysisRateLimiter: exports.analysisRateLimiter,
};
//# sourceMappingURL=rateLimiter.js.map