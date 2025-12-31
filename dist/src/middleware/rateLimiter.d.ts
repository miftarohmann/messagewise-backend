import { Response, NextFunction } from 'express';
import { RateLimitRequestHandler } from 'express-rate-limit';
import { AuthenticatedRequest } from '../types';
/**
 * Standard rate limiter using express-rate-limit
 * For general API endpoints
 */
export declare const standardRateLimiter: RateLimitRequestHandler;
/**
 * Strict rate limiter for sensitive endpoints
 * Authentication, registration, password reset
 */
export declare const strictRateLimiter: RateLimitRequestHandler;
/**
 * Webhook rate limiter
 * Higher limits for incoming webhooks
 */
export declare const webhookRateLimiter: RateLimitRequestHandler;
/**
 * Plan-based rate limiter middleware
 * Applies different limits based on user's subscription plan
 */
export declare function planBasedRateLimiter(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * API Key rate limiter
 * Separate rate limits for API key usage
 */
export declare function apiKeyRateLimiter(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Report generation rate limiter
 * Limit expensive operations
 */
export declare const reportRateLimiter: RateLimitRequestHandler;
/**
 * Cost analysis rate limiter
 * Limit expensive analysis operations
 */
export declare const analysisRateLimiter: RateLimitRequestHandler;
declare const _default: {
    standardRateLimiter: RateLimitRequestHandler;
    strictRateLimiter: RateLimitRequestHandler;
    webhookRateLimiter: RateLimitRequestHandler;
    planBasedRateLimiter: typeof planBasedRateLimiter;
    apiKeyRateLimiter: typeof apiKeyRateLimiter;
    reportRateLimiter: RateLimitRequestHandler;
    analysisRateLimiter: RateLimitRequestHandler;
};
export default _default;
//# sourceMappingURL=rateLimiter.d.ts.map