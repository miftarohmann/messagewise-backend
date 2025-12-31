"use strict";
// =============================================================================
// MessageWise Optimizer - Authentication Routes
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const rateLimiter_1 = require("../middleware/rateLimiter");
const encryption_1 = require("../utils/encryption");
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
/**
 * Generate JWT tokens
 */
function generateTokens(userId, email, plan) {
    const accessToken = jsonwebtoken_1.default.sign({ userId, email, plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = (0, encryption_1.generateSecureToken)(64);
    // Calculate expiry in seconds
    const expiresIn = 7 * 24 * 60 * 60; // 7 days
    return { accessToken, refreshToken, expiresIn };
}
/**
 * Format user response
 */
function formatUserResponse(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        timezone: user.timezone,
        currency: user.currency,
        language: user.language,
        telegramConnected: !!user.telegramId,
        createdAt: user.createdAt,
    };
}
/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', rateLimiter_1.strictRateLimiter, (0, validator_1.validate)(validator_1.userValidation.register), async (req, res) => {
    try {
        const { email, password, name } = req.body;
        // Check if user already exists
        const existingUser = await database_1.db.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_ALREADY_EXISTS,
                    message: 'An account with this email already exists',
                },
            });
            return;
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        // Create user
        const user = await database_1.db.user.create({
            data: {
                email: email.toLowerCase(),
                name,
                passwordHash,
            },
        });
        // Generate tokens
        const tokens = generateTokens(user.id, user.email, user.plan);
        // Create session
        await database_1.db.session.create({
            data: {
                userId: user.id,
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
            },
        });
        logger_1.default.info('User registered', { userId: user.id, email: user.email });
        res.status(201).json({
            success: true,
            data: {
                user: formatUserResponse(user),
                tokens,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Registration failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Registration failed',
            },
        });
    }
});
/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', rateLimiter_1.strictRateLimiter, (0, validator_1.validate)(validator_1.userValidation.login), async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user
        const user = await database_1.db.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (!user) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                    message: 'Invalid email or password',
                },
            });
            return;
        }
        // Verify password
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                    message: 'Invalid email or password',
                },
            });
            return;
        }
        // Generate tokens
        const tokens = generateTokens(user.id, user.email, user.plan);
        // Create session
        await database_1.db.session.create({
            data: {
                userId: user.id,
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
            },
        });
        // Update last login
        await database_1.db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        logger_1.default.info('User logged in', { userId: user.id });
        res.json({
            success: true,
            data: {
                user: formatUserResponse(user),
                tokens,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Login failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Login failed',
            },
        });
    }
});
/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.VALIDATION_MISSING_FIELD,
                    message: 'Refresh token is required',
                },
            });
            return;
        }
        // Find session
        const session = await database_1.db.session.findUnique({
            where: { refreshToken },
            include: { user: true },
        });
        if (!session || session.expiresAt < new Date()) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_TOKEN_EXPIRED,
                    message: 'Invalid or expired refresh token',
                },
            });
            return;
        }
        // Generate new tokens
        const tokens = generateTokens(session.user.id, session.user.email, session.user.plan);
        // Update session
        await database_1.db.session.update({
            where: { id: session.id },
            data: {
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        res.json({
            success: true,
            data: { tokens },
        });
    }
    catch (error) {
        logger_1.default.error('Token refresh failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Token refresh failed',
            },
        });
    }
});
/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', auth_1.authenticate, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (token) {
            await database_1.db.session.deleteMany({
                where: { token },
            });
        }
        res.json({
            success: true,
            data: { message: 'Logged out successfully' },
        });
    }
    catch (error) {
        logger_1.default.error('Logout failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Logout failed',
            },
        });
    }
});
/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await database_1.db.user.findUnique({
            where: { id: req.user.userId },
        });
        if (!user) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'User not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: formatUserResponse(user),
        });
    }
    catch (error) {
        logger_1.default.error('Get user failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get user',
            },
        });
    }
});
/**
 * PATCH /api/auth/me
 * Update current user
 */
router.patch('/me', auth_1.authenticate, (0, validator_1.validate)(validator_1.userValidation.update), async (req, res) => {
    try {
        const updateData = req.body;
        const user = await database_1.db.user.update({
            where: { id: req.user.userId },
            data: updateData,
        });
        res.json({
            success: true,
            data: formatUserResponse(user),
        });
    }
    catch (error) {
        logger_1.default.error('Update user failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to update user',
            },
        });
    }
});
/**
 * POST /api/auth/change-password
 * Change password
 */
router.post('/change-password', auth_1.authenticate, (0, validator_1.validate)(validator_1.userValidation.changePassword), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await database_1.db.user.findUnique({
            where: { id: req.user.userId },
        });
        if (!user) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'User not found',
                },
            });
            return;
        }
        // Verify current password
        const isValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            res.status(401).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                    message: 'Current password is incorrect',
                },
            });
            return;
        }
        // Hash new password
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        // Update password
        await database_1.db.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });
        // Invalidate all other sessions
        const authHeader = req.headers.authorization;
        const currentToken = authHeader?.split(' ')[1];
        await database_1.db.session.deleteMany({
            where: {
                userId: user.id,
                token: { not: currentToken },
            },
        });
        logger_1.default.info('Password changed', { userId: user.id });
        res.json({
            success: true,
            data: { message: 'Password changed successfully' },
        });
    }
    catch (error) {
        logger_1.default.error('Change password failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to change password',
            },
        });
    }
});
/**
 * POST /api/auth/api-keys
 * Create API key
 */
router.post('/api-keys', auth_1.authenticate, (0, validator_1.validate)([]), async (req, res) => {
    try {
        const { name, permissions, expiresAt } = req.body;
        // Generate API key
        const apiKey = (0, encryption_1.generateApiKey)();
        const keyHash = (0, encryption_1.hashApiKey)(apiKey);
        // Create API key record
        const apiKeyRecord = await database_1.db.apiKey.create({
            data: {
                userId: req.user.userId,
                key: apiKey.slice(0, 10) + '...', // Store only prefix for display
                keyHash,
                name: name || 'API Key',
                permissions: permissions || ['read'],
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
        });
        logger_1.default.info('API key created', { userId: req.user.userId, keyId: apiKeyRecord.id });
        // Return the full key only once
        res.status(201).json({
            success: true,
            data: {
                id: apiKeyRecord.id,
                key: apiKey, // Full key returned only on creation
                name: apiKeyRecord.name,
                permissions: apiKeyRecord.permissions,
                expiresAt: apiKeyRecord.expiresAt,
                createdAt: apiKeyRecord.createdAt,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Create API key failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create API key',
            },
        });
    }
});
/**
 * GET /api/auth/api-keys
 * List API keys
 */
router.get('/api-keys', auth_1.authenticate, async (req, res) => {
    try {
        const apiKeys = await database_1.db.apiKey.findMany({
            where: { userId: req.user.userId },
            select: {
                id: true,
                key: true, // This is the masked version
                name: true,
                permissions: true,
                lastUsedAt: true,
                isActive: true,
                expiresAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: apiKeys,
        });
    }
    catch (error) {
        logger_1.default.error('List API keys failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to list API keys',
            },
        });
    }
});
/**
 * DELETE /api/auth/api-keys/:keyId
 * Delete API key
 */
router.delete('/api-keys/:keyId', auth_1.authenticate, async (req, res) => {
    try {
        const { keyId } = req.params;
        await database_1.db.apiKey.deleteMany({
            where: {
                id: keyId,
                userId: req.user.userId,
            },
        });
        res.json({
            success: true,
            data: { message: 'API key deleted' },
        });
    }
    catch (error) {
        logger_1.default.error('Delete API key failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to delete API key',
            },
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map