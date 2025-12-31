"use strict";
// =============================================================================
// MessageWise Optimizer - Express Server Entry Point
// =============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const rateLimiter_1 = require("./middleware/rateLimiter");
const constants_1 = require("./config/constants");
const logger_1 = __importStar(require("./utils/logger"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const accounts_1 = __importDefault(require("./routes/accounts"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const reports_1 = __importDefault(require("./routes/reports"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const payment_1 = __importDefault(require("./routes/payment"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// =============================================================================
// Middleware
// =============================================================================
// Security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false,
}));
// CORS
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
// Body parsing
// Raw body for webhook signature verification
app.use('/api/webhooks/stripe', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        (0, logger_1.logRequest)(req.method, req.path, res.statusCode, duration);
    });
    next();
});
// Rate limiting (except for webhooks)
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/webhooks')) {
        return next();
    }
    (0, rateLimiter_1.standardRateLimiter)(req, res, next);
});
// =============================================================================
// Routes
// =============================================================================
// Health check
app.get('/health', async (req, res) => {
    const dbHealthy = await (0, database_1.checkDatabaseHealth)();
    const redisHealthy = await (0, redis_1.checkRedisHealth)();
    const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';
    res.status(status === 'healthy' ? 200 : 503).json({
        status,
        version: constants_1.APP_VERSION,
        timestamp: new Date().toISOString(),
        services: {
            database: dbHealthy ? 'up' : 'down',
            redis: redisHealthy ? 'up' : 'down',
        },
    });
});
// API info
app.get('/api', (req, res) => {
    res.json({
        name: constants_1.APP_NAME,
        version: constants_1.APP_VERSION,
        apiVersion: constants_1.API_VERSION,
        docs: '/api/docs',
    });
});
// Mount routes
app.use('/api/auth', auth_1.default);
app.use('/api/accounts', accounts_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/webhooks', webhooks_1.default);
app.use('/api/payment', payment_1.default);
// =============================================================================
// Error Handling
// =============================================================================
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
});
// Global error handler
app.use((err, req, res, next) => {
    logger_1.default.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    res.status(500).json({
        success: false,
        error: {
            code: constants_1.ERROR_CODES.INTERNAL_ERROR,
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred'
                : err.message,
        },
    });
});
// =============================================================================
// Server Startup
// =============================================================================
async function startServer() {
    try {
        // Connect to database
        logger_1.default.info('Connecting to database...');
        await (0, database_1.connectDatabase)();
        // Connect to Redis (optional - continue if fails)
        logger_1.default.info('Connecting to Redis...');
        try {
            await (0, redis_1.connectRedis)();
        }
        catch (redisError) {
            logger_1.default.warn('Redis connection failed - running without cache', { error: redisError });
            logger_1.default.warn('To enable caching, install and start Redis locally');
        }
        // Start server
        app.listen(PORT, () => {
            logger_1.default.info(`🚀 ${constants_1.APP_NAME} API Server started`, {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                version: constants_1.APP_VERSION,
            });
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server', { error });
        process.exit(1);
    }
}
// Graceful shutdown
async function shutdown(signal) {
    logger_1.default.info(`${signal} received, shutting down gracefully...`);
    try {
        await (0, database_1.disconnectDatabase)();
        await (0, redis_1.disconnectRedis)();
        logger_1.default.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error('Error during shutdown', { error });
        process.exit(1);
    }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection', { reason, promise });
});
// Start the server
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map