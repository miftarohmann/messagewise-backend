"use strict";
// =============================================================================
// MessageWise Optimizer - Authentication Middleware
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
exports.authenticateJWT = authenticateJWT;
exports.authenticateApiKey = authenticateApiKey;
exports.authenticate = authenticate;
exports.requirePlan = requirePlan;
exports.requirePermission = requirePermission;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const encryption_1 = require("../utils/encryption");
const logger_1 = __importStar(require("../utils/logger"));
const constants_1 = require("../config/constants");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header
 */
async function authenticateJWT(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_UNAUTHORIZED,
                    message: 'No authorization header provided',
                },
            });
            return;
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_TOKEN_INVALID,
                    message: 'Invalid authorization header format. Use: Bearer <token>',
                },
            });
            return;
        }
        const token = parts[1];
        // Check if token is in cache (for faster validation)
        const cachedPayload = await (0, redis_1.cacheGet)(redis_1.CacheKeys.userSession(token));
        if (cachedPayload) {
            req.user = cachedPayload;
            next();
            return;
        }
        // Verify JWT token
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Check if session exists in database
        const session = await database_1.db.session.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!session || session.expiresAt < new Date()) {
            (0, logger_1.logSecurityEvent)('Invalid or expired session', { userId: payload.userId });
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_TOKEN_EXPIRED,
                    message: 'Session expired or invalid',
                },
            });
            return;
        }
        // Update user info from database
        const user = {
            userId: session.user.id,
            email: session.user.email,
            plan: session.user.plan,
        };
        // Cache the session for 5 minutes
        await (0, redis_1.cacheSet)(redis_1.CacheKeys.userSession(token), user, 300);
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_TOKEN_EXPIRED,
                    message: 'Token has expired',
                },
            });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_TOKEN_INVALID,
                    message: 'Invalid token',
                },
            });
            return;
        }
        logger_1.default.error('Authentication error', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Authentication failed',
            },
        });
    }
}
/**
 * API Key Authentication Middleware
 * Validates API key from X-API-Key header
 */
async function authenticateApiKey(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_UNAUTHORIZED,
                    message: 'No API key provided',
                },
            });
            return;
        }
        // Hash the API key for lookup
        const keyHash = (0, encryption_1.hashApiKey)(apiKey);
        // Look up the API key
        const apiKeyRecord = await database_1.db.apiKey.findFirst({
            where: {
                keyHash,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            include: {
                user: true,
            },
        });
        if (!apiKeyRecord) {
            (0, logger_1.logSecurityEvent)('Invalid API key attempt', { keyPrefix: apiKey.slice(0, 10) });
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_TOKEN_INVALID,
                    message: 'Invalid or expired API key',
                },
            });
            return;
        }
        // Update last used timestamp
        await database_1.db.apiKey.update({
            where: { id: apiKeyRecord.id },
            data: { lastUsedAt: new Date() },
        });
        // Set user and API key info on request
        req.user = {
            userId: apiKeyRecord.user.id,
            email: apiKeyRecord.user.email,
            plan: apiKeyRecord.user.plan,
        };
        req.apiKey = {
            keyId: apiKeyRecord.id,
            userId: apiKeyRecord.userId,
            permissions: apiKeyRecord.permissions,
        };
        next();
    }
    catch (error) {
        logger_1.default.error('API key authentication error', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Authentication failed',
            },
        });
    }
}
/**
 * Combined authentication middleware
 * Tries JWT first, then API key
 */
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    if (authHeader) {
        return authenticateJWT(req, res, next);
    }
    if (apiKey) {
        return authenticateApiKey(req, res, next);
    }
    res.status(401).json({
        success: false,
        error: {
            code: constants_1.ERROR_CODES.AUTH_UNAUTHORIZED,
            message: 'Authentication required. Provide a Bearer token or API key.',
        },
    });
}
/**
 * Plan-based authorization middleware
 * Checks if user has required plan level
 */
function requirePlan(...allowedPlans) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_UNAUTHORIZED,
                    message: 'Authentication required',
                },
            });
            return;
        }
        if (!allowedPlans.includes(req.user.plan)) {
            res.status(403).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
                    message: `This feature requires one of the following plans: ${allowedPlans.join(', ')}`,
                },
            });
            return;
        }
        next();
    };
}
/**
 * Permission-based authorization for API keys
 */
function requirePermission(...requiredPermissions) {
    return (req, res, next) => {
        if (!req.apiKey) {
            // If using JWT auth, all permissions are granted
            if (req.user) {
                next();
                return;
            }
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_UNAUTHORIZED,
                    message: 'Authentication required',
                },
            });
            return;
        }
        const hasPermission = requiredPermissions.every((perm) => req.apiKey.permissions.includes(perm));
        if (!hasPermission) {
            res.status(403).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
                    message: `API key missing required permissions: ${requiredPermissions.join(', ')}`,
                },
            });
            return;
        }
        next();
    };
}
/**
 * Optional authentication middleware
 * Attaches user info if authenticated, but doesn't require it
 */
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    if (!authHeader && !apiKey) {
        next();
        return;
    }
    // Try to authenticate but don't fail if it doesn't work
    try {
        if (authHeader) {
            const parts = authHeader.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                const token = parts[1];
                const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                req.user = payload;
            }
        }
        else if (apiKey) {
            const keyHash = (0, encryption_1.hashApiKey)(apiKey);
            const apiKeyRecord = await database_1.db.apiKey.findFirst({
                where: {
                    keyHash,
                    isActive: true,
                },
                include: { user: true },
            });
            if (apiKeyRecord) {
                req.user = {
                    userId: apiKeyRecord.user.id,
                    email: apiKeyRecord.user.email,
                    plan: apiKeyRecord.user.plan,
                };
            }
        }
    }
    catch {
        // Ignore authentication errors for optional auth
    }
    next();
}
exports.default = {
    authenticateJWT,
    authenticateApiKey,
    authenticate,
    requirePlan,
    requirePermission,
    optionalAuth,
};
//# sourceMappingURL=auth.js.map