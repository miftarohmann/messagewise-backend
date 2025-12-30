// =============================================================================
// MessageWise Optimizer - Authentication Middleware
// =============================================================================

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { cacheGet, cacheSet, CacheKeys } from '../config/redis';
import { AuthenticatedRequest, JWTPayload, ApiKeyPayload } from '../types';
import { hashApiKey } from '../utils/encryption';
import logger, { logSecurityEvent } from '../utils/logger';
import { ERROR_CODES } from '../config/constants';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header
 */
export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_UNAUTHORIZED,
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
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid authorization header format. Use: Bearer <token>',
        },
      });
      return;
    }

    const token = parts[1];

    // Check if token is in cache (for faster validation)
    const cachedPayload = await cacheGet<JWTPayload>(CacheKeys.userSession(token));

    if (cachedPayload) {
      req.user = cachedPayload;
      next();
      return;
    }

    // Verify JWT token
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if session exists in database
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      logSecurityEvent('Invalid or expired session', { userId: payload.userId });

      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Session expired or invalid',
        },
      });
      return;
    }

    // Update user info from database
    const user: JWTPayload = {
      userId: session.user.id,
      email: session.user.email,
      plan: session.user.plan,
    };

    // Cache the session for 5 minutes
    await cacheSet(CacheKeys.userSession(token), user, 300);

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Token has expired',
        },
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid token',
        },
      });
      return;
    }

    logger.error('Authentication error', { error });

    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * API Key Authentication Middleware
 * Validates API key from X-API-Key header
 */
export async function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'No API key provided',
        },
      });
      return;
    }

    // Hash the API key for lookup
    const keyHash = hashApiKey(apiKey);

    // Look up the API key
    const apiKeyRecord = await db.apiKey.findFirst({
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
      logSecurityEvent('Invalid API key attempt', { keyPrefix: apiKey.slice(0, 10) });

      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid or expired API key',
        },
      });
      return;
    }

    // Update last used timestamp
    await db.apiKey.update({
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
  } catch (error) {
    logger.error('API key authentication error', { error });

    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Combined authentication middleware
 * Tries JWT first, then API key
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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
      code: ERROR_CODES.AUTH_UNAUTHORIZED,
      message: 'Authentication required. Provide a Bearer token or API key.',
    },
  });
}

/**
 * Plan-based authorization middleware
 * Checks if user has required plan level
 */
export function requirePlan(...allowedPlans: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!allowedPlans.includes(req.user.plan)) {
      res.status(403).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_FORBIDDEN,
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
export function requirePermission(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      // If using JWT auth, all permissions are granted
      if (req.user) {
        next();
        return;
      }

      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'Authentication required',
        },
      });
      return;
    }

    const hasPermission = requiredPermissions.every((perm) =>
      req.apiKey!.permissions.includes(perm)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_FORBIDDEN,
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
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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
        const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
        req.user = payload;
      }
    } else if (apiKey) {
      const keyHash = hashApiKey(apiKey as string);
      const apiKeyRecord = await db.apiKey.findFirst({
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
  } catch {
    // Ignore authentication errors for optional auth
  }

  next();
}

export default {
  authenticateJWT,
  authenticateApiKey,
  authenticate,
  requirePlan,
  requirePermission,
  optionalAuth,
};
