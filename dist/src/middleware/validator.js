"use strict";
// =============================================================================
// MessageWise Optimizer - Input Validation Middleware
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationValidation = exports.apiKeyValidation = exports.webhookValidation = exports.messageValidation = exports.reportValidation = exports.analyticsValidation = exports.accountValidation = exports.userValidation = void 0;
exports.handleValidationErrors = handleValidationErrors;
exports.validate = validate;
const express_validator_1 = require("express-validator");
const constants_1 = require("../config/constants");
/**
 * Validation result handler
 * Checks for validation errors and returns appropriate response
 */
function handleValidationErrors(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.VALIDATION_FAILED,
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
function validate(validations) {
    return async (req, res, next) => {
        // Run all validations
        await Promise.all(validations.map((validation) => validation.run(req)));
        // Check for errors
        handleValidationErrors(req, res, next);
    };
}
// =============================================================================
// User Validation Rules
// =============================================================================
exports.userValidation = {
    register: [
        (0, express_validator_1.body)('email')
            .isEmail()
            .withMessage('Valid email is required')
            .normalizeEmail()
            .isLength({ max: 255 })
            .withMessage('Email must be less than 255 characters'),
        (0, express_validator_1.body)('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/[A-Z]/)
            .withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/)
            .withMessage('Password must contain at least one lowercase letter')
            .matches(/[0-9]/)
            .withMessage('Password must contain at least one number'),
        (0, express_validator_1.body)('name')
            .optional()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters')
            .trim(),
    ],
    login: [
        (0, express_validator_1.body)('email')
            .isEmail()
            .withMessage('Valid email is required')
            .normalizeEmail(),
        (0, express_validator_1.body)('password')
            .notEmpty()
            .withMessage('Password is required'),
    ],
    update: [
        (0, express_validator_1.body)('name')
            .optional()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters')
            .trim(),
        (0, express_validator_1.body)('timezone')
            .optional()
            .isString()
            .withMessage('Timezone must be a string'),
        (0, express_validator_1.body)('currency')
            .optional()
            .isIn(['USD', 'IDR'])
            .withMessage('Currency must be USD or IDR'),
        (0, express_validator_1.body)('language')
            .optional()
            .isIn(['en', 'id'])
            .withMessage('Language must be en or id'),
        (0, express_validator_1.body)('emailNotifications')
            .optional()
            .isBoolean()
            .withMessage('emailNotifications must be a boolean'),
        (0, express_validator_1.body)('telegramNotifications')
            .optional()
            .isBoolean()
            .withMessage('telegramNotifications must be a boolean'),
        (0, express_validator_1.body)('costAlertThreshold')
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage('costAlertThreshold must be between 0 and 100'),
    ],
    changePassword: [
        (0, express_validator_1.body)('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        (0, express_validator_1.body)('newPassword')
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
exports.accountValidation = {
    create: [
        (0, express_validator_1.body)('waBusinessId')
            .isString()
            .matches(/^\d{15,20}$/)
            .withMessage('Invalid WhatsApp Business ID format'),
        (0, express_validator_1.body)('waPhoneNumberId')
            .isString()
            .matches(/^\d{15,20}$/)
            .withMessage('Invalid Phone Number ID format'),
        (0, express_validator_1.body)('waAccessToken')
            .isString()
            .isLength({ min: 50 })
            .withMessage('Invalid access token'),
        (0, express_validator_1.body)('waPhoneNumber')
            .isString()
            .matches(/^\+[1-9]\d{1,14}$/)
            .withMessage('Phone number must be in E.164 format (e.g., +628123456789)'),
        (0, express_validator_1.body)('accountName')
            .isString()
            .isLength({ min: 2, max: 100 })
            .withMessage('Account name must be between 2 and 100 characters')
            .trim(),
        (0, express_validator_1.body)('monthlyBudget')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Monthly budget must be a positive number'),
    ],
    update: [
        (0, express_validator_1.param)('accountId')
            .isString()
            .notEmpty()
            .withMessage('Account ID is required'),
        (0, express_validator_1.body)('accountName')
            .optional()
            .isString()
            .isLength({ min: 2, max: 100 })
            .withMessage('Account name must be between 2 and 100 characters')
            .trim(),
        (0, express_validator_1.body)('monthlyBudget')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Monthly budget must be a positive number'),
        (0, express_validator_1.body)('alertThreshold')
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage('Alert threshold must be between 0 and 100'),
        (0, express_validator_1.body)('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean'),
    ],
    getById: [
        (0, express_validator_1.param)('accountId')
            .isString()
            .notEmpty()
            .withMessage('Account ID is required'),
    ],
};
// =============================================================================
// Analytics Validation Rules
// =============================================================================
exports.analyticsValidation = {
    summary: [
        (0, express_validator_1.query)('accountId')
            .optional()
            .isString()
            .withMessage('Account ID must be a string'),
        (0, express_validator_1.query)('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        (0, express_validator_1.query)('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date'),
    ],
    breakdown: [
        (0, express_validator_1.param)('accountId')
            .isString()
            .notEmpty()
            .withMessage('Account ID is required'),
        (0, express_validator_1.query)('startDate')
            .isISO8601()
            .withMessage('Start date is required and must be a valid ISO 8601 date'),
        (0, express_validator_1.query)('endDate')
            .isISO8601()
            .withMessage('End date is required and must be a valid ISO 8601 date'),
        (0, express_validator_1.query)('groupBy')
            .optional()
            .isIn(['day', 'week', 'month'])
            .withMessage('groupBy must be day, week, or month'),
    ],
    trends: [
        (0, express_validator_1.param)('accountId')
            .isString()
            .notEmpty()
            .withMessage('Account ID is required'),
        (0, express_validator_1.query)('period')
            .optional()
            .isIn(['7d', '30d', '90d', '1y'])
            .withMessage('Period must be 7d, 30d, 90d, or 1y'),
    ],
};
// =============================================================================
// Report Validation Rules
// =============================================================================
exports.reportValidation = {
    generate: [
        (0, express_validator_1.body)('accountId')
            .isString()
            .notEmpty()
            .withMessage('Account ID is required'),
        (0, express_validator_1.body)('startDate')
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        (0, express_validator_1.body)('endDate')
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date'),
        (0, express_validator_1.body)('format')
            .optional()
            .isIn(['json', 'pdf', 'csv'])
            .withMessage('Format must be json, pdf, or csv'),
        (0, express_validator_1.body)('includeRecommendations')
            .optional()
            .isBoolean()
            .withMessage('includeRecommendations must be a boolean'),
        (0, express_validator_1.body)('includeMessageDetails')
            .optional()
            .isBoolean()
            .withMessage('includeMessageDetails must be a boolean'),
    ],
};
// =============================================================================
// Message Validation Rules
// =============================================================================
exports.messageValidation = {
    list: [
        (0, express_validator_1.query)('accountId')
            .optional()
            .isString()
            .withMessage('Account ID must be a string'),
        (0, express_validator_1.query)('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        (0, express_validator_1.query)('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date'),
        (0, express_validator_1.query)('category')
            .optional()
            .isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'])
            .withMessage('Invalid category'),
        (0, express_validator_1.query)('direction')
            .optional()
            .isIn(['INBOUND', 'OUTBOUND'])
            .withMessage('Direction must be INBOUND or OUTBOUND'),
        (0, express_validator_1.query)('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        (0, express_validator_1.query)('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
    ],
    reclassify: [
        (0, express_validator_1.param)('messageId')
            .isString()
            .notEmpty()
            .withMessage('Message ID is required'),
        (0, express_validator_1.body)('category')
            .isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'])
            .withMessage('Invalid category'),
    ],
};
// =============================================================================
// Webhook Validation Rules
// =============================================================================
exports.webhookValidation = {
    whatsapp: [
        (0, express_validator_1.body)('object')
            .equals('whatsapp_business_account')
            .withMessage('Invalid webhook object type'),
        (0, express_validator_1.body)('entry')
            .isArray()
            .withMessage('Entry must be an array'),
    ],
    verify: [
        (0, express_validator_1.query)('hub.mode')
            .equals('subscribe')
            .withMessage('Invalid hub.mode'),
        (0, express_validator_1.query)('hub.verify_token')
            .isString()
            .notEmpty()
            .withMessage('Verify token is required'),
        (0, express_validator_1.query)('hub.challenge')
            .isString()
            .notEmpty()
            .withMessage('Challenge is required'),
    ],
};
// =============================================================================
// API Key Validation Rules
// =============================================================================
exports.apiKeyValidation = {
    create: [
        (0, express_validator_1.body)('name')
            .isString()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters')
            .trim(),
        (0, express_validator_1.body)('permissions')
            .optional()
            .isArray()
            .withMessage('Permissions must be an array'),
        (0, express_validator_1.body)('expiresAt')
            .optional()
            .isISO8601()
            .withMessage('Expiration date must be a valid ISO 8601 date'),
    ],
    update: [
        (0, express_validator_1.param)('keyId')
            .isString()
            .notEmpty()
            .withMessage('API key ID is required'),
        (0, express_validator_1.body)('name')
            .optional()
            .isString()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters')
            .trim(),
        (0, express_validator_1.body)('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean'),
    ],
};
// =============================================================================
// Pagination Validation Helper
// =============================================================================
exports.paginationValidation = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .toInt()
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .toInt()
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('sortBy')
        .optional()
        .isString()
        .withMessage('sortBy must be a string'),
    (0, express_validator_1.query)('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('sortOrder must be asc or desc'),
];
exports.default = {
    validate,
    handleValidationErrors,
    userValidation: exports.userValidation,
    accountValidation: exports.accountValidation,
    analyticsValidation: exports.analyticsValidation,
    reportValidation: exports.reportValidation,
    messageValidation: exports.messageValidation,
    webhookValidation: exports.webhookValidation,
    apiKeyValidation: exports.apiKeyValidation,
    paginationValidation: exports.paginationValidation,
};
//# sourceMappingURL=validator.js.map