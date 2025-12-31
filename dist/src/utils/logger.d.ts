import winston from 'winston';
declare const logger: winston.Logger;
/**
 * Log HTTP request
 */
export declare function logRequest(method: string, url: string, statusCode: number, duration: number, userId?: string): void;
/**
 * Log error with context
 */
export declare function logError(message: string, error: Error | unknown, context?: Record<string, unknown>): void;
/**
 * Log API call to external service
 */
export declare function logApiCall(service: string, method: string, endpoint: string, statusCode?: number, duration?: number): void;
/**
 * Log database operation
 */
export declare function logDbOperation(operation: string, table: string, duration?: number, recordCount?: number): void;
/**
 * Log cache operation
 */
export declare function logCacheOperation(operation: string, key: string, hit?: boolean): void;
/**
 * Log security event
 */
export declare function logSecurityEvent(event: string, details: Record<string, unknown>): void;
/**
 * Log business metric
 */
export declare function logMetric(metric: string, value: number, tags?: Record<string, string>): void;
export declare const stream: {
    write: (message: string) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map