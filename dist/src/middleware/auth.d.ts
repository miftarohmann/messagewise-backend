import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header
 */
export declare function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * API Key Authentication Middleware
 * Validates API key from X-API-Key header
 */
export declare function authenticateApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Combined authentication middleware
 * Tries JWT first, then API key
 */
export declare function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Plan-based authorization middleware
 * Checks if user has required plan level
 */
export declare function requirePlan(...allowedPlans: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Permission-based authorization for API keys
 */
export declare function requirePermission(...requiredPermissions: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Optional authentication middleware
 * Attaches user info if authenticated, but doesn't require it
 */
export declare function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
declare const _default: {
    authenticateJWT: typeof authenticateJWT;
    authenticateApiKey: typeof authenticateApiKey;
    authenticate: typeof authenticate;
    requirePlan: typeof requirePlan;
    requirePermission: typeof requirePermission;
    optionalAuth: typeof optionalAuth;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map