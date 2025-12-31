"use strict";
// =============================================================================
// MessageWise Optimizer - Database Configuration
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getPrismaClient = getPrismaClient;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
exports.checkDatabaseHealth = checkDatabaseHealth;
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
// Prisma client singleton
let prisma;
/**
 * Get or create Prisma client instance
 */
function getPrismaClient() {
    if (!prisma) {
        // Use global variable in development to prevent multiple instances
        if (process.env.NODE_ENV === 'development') {
            if (!global.__prisma) {
                global.__prisma = createPrismaClient();
            }
            prisma = global.__prisma;
        }
        else {
            prisma = createPrismaClient();
        }
    }
    return prisma;
}
/**
 * Create a new Prisma client with logging configuration
 */
function createPrismaClient() {
    const client = new client_1.PrismaClient({
        log: [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
        ],
    });
    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
        client.$on('query', (e) => {
            logger_1.default.debug('Prisma Query', {
                query: e.query,
                params: e.params,
                duration: `${e.duration}ms`,
            });
        });
    }
    // Log errors
    client.$on('error', (e) => {
        logger_1.default.error('Prisma Error', { message: e.message });
    });
    // Log warnings
    client.$on('warn', (e) => {
        logger_1.default.warn('Prisma Warning', { message: e.message });
    });
    return client;
}
/**
 * Connect to the database
 */
async function connectDatabase() {
    const client = getPrismaClient();
    try {
        await client.$connect();
        logger_1.default.info('Database connected successfully');
        // Run a test query to verify connection
        await client.$queryRaw `SELECT 1`;
        logger_1.default.info('Database connection verified');
    }
    catch (error) {
        logger_1.default.error('Database connection failed', { error });
        throw error;
    }
}
/**
 * Disconnect from the database
 */
async function disconnectDatabase() {
    const client = getPrismaClient();
    try {
        await client.$disconnect();
        logger_1.default.info('Database disconnected successfully');
    }
    catch (error) {
        logger_1.default.error('Database disconnection failed', { error });
        throw error;
    }
}
/**
 * Health check for database
 */
async function checkDatabaseHealth() {
    const client = getPrismaClient();
    try {
        await client.$queryRaw `SELECT 1`;
        return true;
    }
    catch {
        return false;
    }
}
// Export default client
exports.db = getPrismaClient();
exports.default = exports.db;
//# sourceMappingURL=database.js.map