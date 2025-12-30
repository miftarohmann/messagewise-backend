// =============================================================================
// MessageWise Optimizer - Input Validation Middleware
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { ERROR_CODES } from '../config/constants';

/**
 * Validation result handler
 * Checks for validation errors and returns appropriate response
 */
export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Validation failed',
        details: errors.array().map((err) => ({
          field: 'path' in err ? err.path : 'unknown',
          message: err.msg,
        })),
      },
    });
    return;
  }

  next();
}

/**
 * Create validation middleware chain with error handling
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for errors
    handleValidationErrors(req, res, next);
  };
}

// =============================================================================
// User Validation Rules
// =============================================================================

export const userValidation = {
  register: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Email must be less than 255 characters'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .trim(),
  ],

  login: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],

  update: [
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .trim(),
    body('timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a string'),
    body('currency')
      .optional()
      .isIn(['USD', 'IDR'])
      .withMessage('Currency must be USD or IDR'),
    body('language')
      .optional()
      .isIn(['en', 'id'])
      .withMessage('Language must be en or id'),
    body('emailNotifications')
      .optional()
      .isBoolean()
      .withMessage('emailNotifications must be a boolean'),
    body('telegramNotifications')
      .optional()
      .isBoolean()
      .withMessage('telegramNotifications must be a boolean'),
    body('costAlertThreshold')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('costAlertThreshold must be between 0 and 100'),
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
  ],
};

// =============================================================================
// Account Validation Rules
// =============================================================================

export const accountValidation = {
  create: [
    body('waBusinessId')
      .isString()
      .matches(/^\d{15,20}$/)
      .withMessage('Invalid WhatsApp Business ID format'),
    body('waPhoneNumberId')
      .isString()
      .matches(/^\d{15,20}$/)
      .withMessage('Invalid Phone Number ID format'),
    body('waAccessToken')
      .isString()
      .isLength({ min: 50 })
      .withMessage('Invalid access token'),
    body('waPhoneNumber')
      .isString()
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage('Phone number must be in E.164 format (e.g., +628123456789)'),
    body('accountName')
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Account name must be between 2 and 100 characters')
      .trim(),
    body('monthlyBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Monthly budget must be a positive number'),
  ],

  update: [
    param('accountId')
      .isString()
      .notEmpty()
      .withMessage('Account ID is required'),
    body('accountName')
      .optional()
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Account name must be between 2 and 100 characters')
      .trim(),
    body('monthlyBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Monthly budget must be a positive number'),
    body('alertThreshold')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Alert threshold must be between 0 and 100'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],

  getById: [
    param('accountId')
      .isString()
      .notEmpty()
      .withMessage('Account ID is required'),
  ],
};

// =============================================================================
// Analytics Validation Rules
// =============================================================================

export const analyticsValidation = {
  summary: [
    query('accountId')
      .optional()
      .isString()
      .withMessage('Account ID must be a string'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],

  breakdown: [
    param('accountId')
      .isString()
      .notEmpty()
      .withMessage('Account ID is required'),
    query('startDate')
      .isISO8601()
      .withMessage('Start date is required and must be a valid ISO 8601 date'),
    query('endDate')
      .isISO8601()
      .withMessage('End date is required and must be a valid ISO 8601 date'),
    query('groupBy')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage('groupBy must be day, week, or month'),
  ],

  trends: [
    param('accountId')
      .isString()
      .notEmpty()
      .withMessage('Account ID is required'),
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Period must be 7d, 30d, 90d, or 1y'),
  ],
};

// =============================================================================
// Report Validation Rules
// =============================================================================

export const reportValidation = {
  generate: [
    body('accountId')
      .isString()
      .notEmpty()
      .withMessage('Account ID is required'),
    body('startDate')
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate')
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('format')
      .optional()
      .isIn(['json', 'pdf', 'csv'])
      .withMessage('Format must be json, pdf, or csv'),
    body('includeRecommendations')
      .optional()
      .isBoolean()
      .withMessage('includeRecommendations must be a boolean'),
    body('includeMessageDetails')
      .optional()
      .isBoolean()
      .withMessage('includeMessageDetails must be a boolean'),
  ],
};

// =============================================================================
// Message Validation Rules
// =============================================================================

export const messageValidation = {
  list: [
    query('accountId')
      .optional()
      .isString()
      .withMessage('Account ID must be a string'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('category')
      .optional()
      .isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'])
      .withMessage('Invalid category'),
    query('direction')
      .optional()
      .isIn(['INBOUND', 'OUTBOUND'])
      .withMessage('Direction must be INBOUND or OUTBOUND'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  reclassify: [
    param('messageId')
      .isString()
      .notEmpty()
      .withMessage('Message ID is required'),
    body('category')
      .isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'])
      .withMessage('Invalid category'),
  ],
};

// =============================================================================
// Webhook Validation Rules
// =============================================================================

export const webhookValidation = {
  whatsapp: [
    body('object')
      .equals('whatsapp_business_account')
      .withMessage('Invalid webhook object type'),
    body('entry')
      .isArray()
      .withMessage('Entry must be an array'),
  ],

  verify: [
    query('hub.mode')
      .equals('subscribe')
      .withMessage('Invalid hub.mode'),
    query('hub.verify_token')
      .isString()
      .notEmpty()
      .withMessage('Verify token is required'),
    query('hub.challenge')
      .isString()
      .notEmpty()
      .withMessage('Challenge is required'),
  ],
};

// =============================================================================
// API Key Validation Rules
// =============================================================================

export const apiKeyValidation = {
  create: [
    body('name')
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .trim(),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expiration date must be a valid ISO 8601 date'),
  ],

  update: [
    param('keyId')
      .isString()
      .notEmpty()
      .withMessage('API key ID is required'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .trim(),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],
};

// =============================================================================
// Pagination Validation Helper
// =============================================================================

export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isString()
    .withMessage('sortBy must be a string'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be asc or desc'),
];

export default {
  validate,
  handleValidationErrors,
  userValidation,
  accountValidation,
  analyticsValidation,
  reportValidation,
  messageValidation,
  webhookValidation,
  apiKeyValidation,
  paginationValidation,
};
