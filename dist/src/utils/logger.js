"use strict";
// =============================================================================
// MessageWise Optimizer - Winston Logger Configuration
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
exports.logRequest = logRequest;
exports.logError = logError;
exports.logApiCall = logApiCall;
exports.logDbOperation = logDbOperation;
exports.logCacheOperation = logCacheOperation;
exports.logSecurityEvent = logSecurityEvent;
exports.logMetric = logMetric;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define level colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
winston_1.default.addColors(colors);
// Get log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const configuredLevel = process.env.LOG_LEVEL;
    if (configuredLevel) {
        return configuredLevel;
    }
    return env === 'development' ? 'debug' : 'info';
};
// Custom format for console output
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
}));
// Custom format for file output
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// Define transports
const transports = [
    // Console output
    new winston_1.default.transports.Console({
        format: consoleFormat,
    }),
];
// Add file transports in production
if (process.env.NODE_ENV === 'production') {
    const logsDir = process.env.LOGS_DIR || 'logs';
    transports.push(
    // Error logs
    new winston_1.default.transports.File({
        filename: path_1.default.join(logsDir, 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }), 
    // Combined logs
    new winston_1.default.transports.File({
        filename: path_1.default.join(logsDir, 'combined.log'),
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));
}
// Create the logger
const logger = winston_1.default.createLogger({
    level: level(),
    levels,
    transports,
    exitOnError: false,
});
// =============================================================================
// Logger Helper Functions
// =============================================================================
/**
 * Log HTTP request
 */
function logRequest(method, url, statusCode, duration, userId) {
    logger.http('HTTP Request', {
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
        userId: userId || 'anonymous',
    });
}
/**
 * Log error with context
 */
function logError(message, error, context) {
    const errorDetails = error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        }
        : { error };
    logger.error(message, {
        ...errorDetails,
        ...context,
    });
}
/**
 * Log API call to external service
 */
function logApiCall(service, method, endpoint, statusCode, duration) {
    logger.debug(`External API call: ${service}`, {
        service,
        method,
        endpoint,
        statusCode,
        duration: duration ? `${duration}ms` : undefined,
    });
}
/**
 * Log database operation
 */
function logDbOperation(operation, table, duration, recordCount) {
    logger.debug(`Database operation: ${operation} on ${table}`, {
        operation,
        table,
        duration: duration ? `${duration}ms` : undefined,
        recordCount,
    });
}
/**
 * Log cache operation
 */
function logCacheOperation(operation, key, hit) {
    logger.debug(`Cache ${operation}: ${key}`, {
        operation,
        key,
        hit,
    });
}
/**
 * Log security event
 */
function logSecurityEvent(event, details) {
    logger.warn(`Security event: ${event}`, details);
}
/**
 * Log business metric
 */
function logMetric(metric, value, tags) {
    logger.info(`Metric: ${metric}`, {
        metric,
        value,
        tags,
    });
}
// =============================================================================
// Stream for Morgan HTTP Logger
// =============================================================================
exports.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};
exports.default = logger;
//# sourceMappingURL=logger.js.map