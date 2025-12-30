// =============================================================================
// MessageWise Optimizer - Database Configuration
// =============================================================================

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

// Prisma client singleton
let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Get or create Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Use global variable in development to prevent multiple instances
    if (process.env.NODE_ENV === 'development') {
      if (!global.__prisma) {
        global.__prisma = createPrismaClient();
      }
      prisma = global.__prisma;
    } else {
      prisma = createPrismaClient();
    }
  }
  return prisma;
}

/**
 * Create a new Prisma client with logging configuration
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e) => {
      logger.debug('Prisma Query', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });
  }

  // Log errors
  client.$on('error', (e) => {
    logger.error('Prisma Error', { message: e.message });
  });

  // Log warnings
  client.$on('warn', (e) => {
    logger.warn('Prisma Warning', { message: e.message });
  });

  return client;
}

/**
 * Connect to the database
 */
export async function connectDatabase(): Promise<void> {
  const client = getPrismaClient();

  try {
    await client.$connect();
    logger.info('Database connected successfully');

    // Run a test query to verify connection
    await client.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  const client = getPrismaClient();

  try {
    await client.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Database disconnection failed', { error });
    throw error;
  }
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  const client = getPrismaClient();

  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Export default client
export const db = getPrismaClient();

export default db;
