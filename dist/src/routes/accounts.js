"use strict";
// =============================================================================
// MessageWise Optimizer - WhatsApp Account Routes
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
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const encryption_1 = require("../utils/encryption");
const constants_1 = require("../config/constants");
const apiClient_1 = require("../services/whatsapp/apiClient");
const notifier_1 = require("../services/telegram/notifier");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * Format account response
 */
function formatAccountResponse(account) {
    return {
        id: account.id,
        waBusinessId: account.waBusinessId,
        waPhoneNumber: account.waPhoneNumber,
        accountName: account.accountName,
        isActive: account.isActive,
        isVerified: account.isVerified,
        lastSyncAt: account.lastSyncAt,
        monthlyBudget: account.monthlyBudget,
        createdAt: account.createdAt,
    };
}
/**
 * GET /api/accounts
 * List all accounts for user
 */
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const accounts = await database_1.db.account.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: accounts.map(formatAccountResponse),
        });
    }
    catch (error) {
        logger_1.default.error('List accounts failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to list accounts',
            },
        });
    }
});
/**
 * GET /api/accounts/:accountId
 * Get account details
 */
router.get('/:accountId', auth_1.authenticate, (0, validator_1.validate)(validator_1.accountValidation.getById), async (req, res) => {
    try {
        const account = await database_1.db.account.findFirst({
            where: {
                id: req.params.accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: formatAccountResponse(account),
        });
    }
    catch (error) {
        logger_1.default.error('Get account failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get account',
            },
        });
    }
});
/**
 * POST /api/accounts
 * Create new WhatsApp account
 */
router.post('/', auth_1.authenticate, (0, validator_1.validate)(validator_1.accountValidation.create), async (req, res) => {
    try {
        const { waBusinessId, waPhoneNumberId, waAccessToken, waPhoneNumber, accountName, monthlyBudget } = req.body;
        // Check account limits
        const user = await database_1.db.user.findUnique({
            where: { id: req.user.userId },
            include: { accounts: true },
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
        const planLimits = constants_1.PRICING[user.plan].limits;
        if (planLimits.accounts !== -1 && user.accounts.length >= planLimits.accounts) {
            res.status(403).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_LIMIT_REACHED,
                    message: `Account limit reached. Upgrade to add more accounts. Current limit: ${planLimits.accounts}`,
                },
            });
            return;
        }
        // Check if business ID already exists
        const existingAccount = await database_1.db.account.findUnique({
            where: { waBusinessId },
        });
        if (existingAccount) {
            res.status(409).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_ALREADY_EXISTS,
                    message: 'This WhatsApp Business account is already connected',
                },
            });
            return;
        }
        // Verify the credentials
        try {
            const encryptedToken = (0, encryption_1.encrypt)(waAccessToken);
            const client = new apiClient_1.WhatsAppApiClient(waPhoneNumberId, encryptedToken);
            const verification = await client.verifyPhoneNumber();
            // Create account
            const account = await database_1.db.account.create({
                data: {
                    userId: req.user.userId,
                    waBusinessId,
                    waPhoneNumberId,
                    waAccessToken: encryptedToken,
                    waPhoneNumber,
                    accountName,
                    monthlyBudget,
                    isVerified: verification.verified,
                },
            });
            // Send Telegram notification
            if (user.telegramId && user.telegramNotifications) {
                const notifier = new notifier_1.TelegramNotifier();
                await notifier.sendAccountConnected(user.telegramId, accountName, waPhoneNumber);
            }
            logger_1.default.info('Account created', { userId: req.user.userId, accountId: account.id });
            res.status(201).json({
                success: true,
                data: formatAccountResponse(account),
            });
        }
        catch (verifyError) {
            logger_1.default.error('WhatsApp verification failed', { error: verifyError });
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.WHATSAPP_API_ERROR,
                    message: 'Failed to verify WhatsApp credentials. Please check your access token and phone number ID.',
                },
            });
        }
    }
    catch (error) {
        logger_1.default.error('Create account failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create account',
            },
        });
    }
});
/**
 * PATCH /api/accounts/:accountId
 * Update account
 */
router.patch('/:accountId', auth_1.authenticate, (0, validator_1.validate)(validator_1.accountValidation.update), async (req, res) => {
    try {
        const { accountId } = req.params;
        const updateData = req.body;
        // Verify ownership
        const existing = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!existing) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        const account = await database_1.db.account.update({
            where: { id: accountId },
            data: updateData,
        });
        res.json({
            success: true,
            data: formatAccountResponse(account),
        });
    }
    catch (error) {
        logger_1.default.error('Update account failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to update account',
            },
        });
    }
});
/**
 * DELETE /api/accounts/:accountId
 * Delete account
 */
router.delete('/:accountId', auth_1.authenticate, async (req, res) => {
    try {
        const { accountId } = req.params;
        const result = await database_1.db.account.deleteMany({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (result.count === 0) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        logger_1.default.info('Account deleted', { accountId });
        res.json({
            success: true,
            data: { message: 'Account deleted successfully' },
        });
    }
    catch (error) {
        logger_1.default.error('Delete account failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to delete account',
            },
        });
    }
});
/**
 * POST /api/accounts/:accountId/sync
 * Trigger account sync
 */
router.post('/:accountId/sync', auth_1.authenticate, async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        // Import and run sync service
        const { MessageSyncService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/messageSync')));
        const syncService = new MessageSyncService();
        const result = await syncService.syncAccount(accountId);
        res.json({
            success: result.success,
            data: {
                messagesProcessed: result.messagesProcessed,
                analysisGenerated: result.analysisGenerated,
                errors: result.errors,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Sync account failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to sync account',
            },
        });
    }
});
/**
 * GET /api/accounts/:accountId/stats
 * Get account statistics
 */
router.get('/:accountId/stats', auth_1.authenticate, async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        // Get message counts
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [totalMessages, monthlyMessages, latestAnalysis] = await Promise.all([
            database_1.db.message.count({ where: { accountId } }),
            database_1.db.message.count({
                where: {
                    accountId,
                    timestamp: { gte: startOfMonth },
                },
            }),
            database_1.db.costAnalysis.findFirst({
                where: { accountId },
                orderBy: { periodStart: 'desc' },
            }),
        ]);
        res.json({
            success: true,
            data: {
                totalMessages,
                monthlyMessages,
                totalCost: latestAnalysis?.totalCost || 0,
                optimizationScore: latestAnalysis?.optimizationScore || 0,
                potentialSavings: latestAnalysis?.potentialSavings || 0,
                lastSync: account.lastSyncAt,
                syncStatus: account.syncStatus,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get account stats failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get account statistics',
            },
        });
    }
});
exports.default = router;
//# sourceMappingURL=accounts.js.map