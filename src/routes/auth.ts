// =============================================================================
// MessageWise Optimizer - Authentication Routes
// =============================================================================

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { AuthenticatedRequest, TokenPair, UserResponse } from '../types';
import { authenticate } from '../middleware/auth';
import { validate, userValidation } from '../middleware/validator';
import { strictRateLimiter } from '../middleware/rateLimiter';
import { generateSecureToken, generateApiKey, hashApiKey } from '../utils/encryption';
import { ERROR_CODES, TIME } from '../config/constants';
import logger from '../utils/logger';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Generate JWT tokens
 */
function generateTokens(userId: string, email: string, plan: string): TokenPair {
  const accessToken = jwt.sign(
    { userId, email, plan },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );

  const refreshToken = generateSecureToken(64);

  // Calculate expiry in seconds
  const expiresIn = 7 * 24 * 60 * 60; // 7 days

  return { accessToken, refreshToken, expiresIn };
}

/**
 * Format user response
 */
function formatUserResponse(user: any): UserResponse {
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
router.post(
  '/register',
  strictRateLimiter,
  validate(userValidation.register),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
            message: 'An account with this email already exists',
          },
        });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await db.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          passwordHash,
        },
      });

      // Generate tokens
      const tokens = generateTokens(user.id, user.email, user.plan);

      // Create session
      await db.session.create({
        data: {
          userId: user.id,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
        },
      });

      logger.info('User registered', { userId: user.id, email: user.email });

      res.status(201).json({
        success: true,
        data: {
          user: formatUserResponse(user),
          tokens,
        },
      });
    } catch (error) {
      logger.error('Registration failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Registration failed',
        },
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  strictRateLimiter,
  validate(userValidation.login),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await db.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
            message: 'Invalid email or password',
          },
        });
        return;
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
            message: 'Invalid email or password',
          },
        });
        return;
      }

      // Generate tokens
      const tokens = generateTokens(user.id, user.email, user.plan);

      // Create session
      await db.session.create({
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
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      logger.info('User logged in', { userId: user.id });

      res.json({
        success: true,
        data: {
          user: formatUserResponse(user),
          tokens,
        },
      });
    } catch (error) {
      logger.error('Login failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Login failed',
        },
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Refresh token is required',
        },
      });
      return;
    }

    // Find session
    const session = await db.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Invalid or expired refresh token',
        },
      });
      return;
    }

    // Generate new tokens
    const tokens = generateTokens(
      session.user.id,
      session.user.email,
      session.user.plan
    );

    // Update session
    await db.session.update({
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
  } catch (error) {
    logger.error('Token refresh failed', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Token refresh failed',
      },
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      await db.session.deleteMany({
        where: { token },
      });
    }

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    logger.error('Logout failed', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Logout failed',
      },
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: formatUserResponse(user),
    });
  } catch (error) {
    logger.error('Get user failed', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get user',
      },
    });
  }
});

/**
 * PATCH /api/auth/me
 * Update current user
 */
router.patch(
  '/me',
  authenticate,
  validate(userValidation.update),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updateData = req.body;

      const user = await db.user.update({
        where: { id: req.user!.userId },
        data: updateData,
      });

      res.json({
        success: true,
        data: formatUserResponse(user),
      });
    } catch (error) {
      logger.error('Update user failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to update user',
        },
      });
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change password
 */
router.post(
  '/change-password',
  authenticate,
  validate(userValidation.changePassword),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await db.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'User not found',
          },
        });
        return;
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!isValid) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
            message: 'Current password is incorrect',
          },
        });
        return;
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // Invalidate all other sessions
      const authHeader = req.headers.authorization;
      const currentToken = authHeader?.split(' ')[1];

      await db.session.deleteMany({
        where: {
          userId: user.id,
          token: { not: currentToken },
        },
      });

      logger.info('Password changed', { userId: user.id });

      res.json({
        success: true,
        data: { message: 'Password changed successfully' },
      });
    } catch (error) {
      logger.error('Change password failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to change password',
        },
      });
    }
  }
);

/**
 * POST /api/auth/api-keys
 * Create API key
 */
router.post(
  '/api-keys',
  authenticate,
  validate([]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, permissions, expiresAt } = req.body;

      // Generate API key
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);

      // Create API key record
      const apiKeyRecord = await db.apiKey.create({
        data: {
          userId: req.user!.userId,
          key: apiKey.slice(0, 10) + '...', // Store only prefix for display
          keyHash,
          name: name || 'API Key',
          permissions: permissions || ['read'],
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      logger.info('API key created', { userId: req.user!.userId, keyId: apiKeyRecord.id });

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
    } catch (error) {
      logger.error('Create API key failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to create API key',
        },
      });
    }
  }
);

/**
 * GET /api/auth/api-keys
 * List API keys
 */
router.get('/api-keys', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const apiKeys = await db.apiKey.findMany({
      where: { userId: req.user!.userId },
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
  } catch (error) {
    logger.error('List API keys failed', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to list API keys',
      },
    });
  }
});

/**
 * DELETE /api/auth/api-keys/:keyId
 * Delete API key
 */
router.delete(
  '/api-keys/:keyId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { keyId } = req.params;

      await db.apiKey.deleteMany({
        where: {
          id: keyId,
          userId: req.user!.userId,
        },
      });

      res.json({
        success: true,
        data: { message: 'API key deleted' },
      });
    } catch (error) {
      logger.error('Delete API key failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to delete API key',
        },
      });
    }
  }
);

export default router;
