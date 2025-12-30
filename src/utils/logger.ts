// =============================================================================
// MessageWise Optimizer - Winston Logger Configuration
// =============================================================================

import winston from 'winston';
import path from 'path';

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

winston.addColors(colors);

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
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports: winston.transport[] = [
  // Console output
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logsDir = process.env.LOGS_DIR || 'logs';

  transports.push(
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
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
export function logRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  userId?: string
): void {
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
export function logError(
  message: string,
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  const errorDetails =
    error instanceof Error
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
export function logApiCall(
  service: string,
  method: string,
  endpoint: string,
  statusCode?: number,
  duration?: number
): void {
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
export function logDbOperation(
  operation: string,
  table: string,
  duration?: number,
  recordCount?: number
): void {
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
export function logCacheOperation(
  operation: string,
  key: string,
  hit?: boolean
): void {
  logger.debug(`Cache ${operation}: ${key}`, {
    operation,
    key,
    hit,
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>
): void {
  logger.warn(`Security event: ${event}`, details);
}

/**
 * Log business metric
 */
export function logMetric(
  metric: string,
  value: number,
  tags?: Record<string, string>
): void {
  logger.info(`Metric: ${metric}`, {
    metric,
    value,
    tags,
  });
}

// =============================================================================
// Stream for Morgan HTTP Logger
// =============================================================================

export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
