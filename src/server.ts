// =============================================================================
// MessageWise Optimizer - Express Server Entry Point
// =============================================================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDatabase, disconnectDatabase, checkDatabaseHealth } from './config/database';
import { connectRedis, disconnectRedis, checkRedisHealth } from './config/redis';
import { standardRateLimiter } from './middleware/rateLimiter';
import { APP_NAME, APP_VERSION, API_VERSION, ERROR_CODES } from './config/constants';
import logger, { logRequest } from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import analyticsRoutes from './routes/analytics';
import reportsRoutes from './routes/reports';
import webhookRoutes from './routes/webhooks';
import paymentRoutes from './routes/payment';

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================================================
// Middleware
// =============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing
// Raw body for webhook signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.path, res.statusCode, duration);
  });

  next();
});

// Rate limiting (except for webhooks)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/webhooks')) {
    return next();
  }
  standardRateLimiter(req, res, next);
});

// =============================================================================
// Routes
// =============================================================================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();
  const redisHealthy = await checkRedisHealth();

  const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';

  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
    },
  });
});

// API info
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: APP_NAME,
    version: APP_VERSION,
    apiVersion: API_VERSION,
    docs: '/api/docs',
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payment', paymentRoutes);

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
});

// =============================================================================
// Server Startup
// =============================================================================

async function startServer(): Promise<void> {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();

    // Connect to Redis (optional - continue if fails)
    logger.info('Connecting to Redis...');
    try {
      await connectRedis();
    } catch (redisError) {
      logger.warn('Redis connection failed - running without cache', { error: redisError });
      logger.warn('To enable caching, install and start Redis locally');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 ${APP_NAME} API Server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: APP_VERSION,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully...`);

  try {
    await disconnectDatabase();
    await disconnectRedis();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// Start the server
startServer();

export default app;
