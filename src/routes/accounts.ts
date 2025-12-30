// =============================================================================
// MessageWise Optimizer - WhatsApp Account Routes
// =============================================================================

import { Router, Response } from 'express';
import { db } from '../config/database';
import { AuthenticatedRequest, AccountResponse } from '../types';
import { authenticate, requirePlan } from '../middleware/auth';
import { validate, accountValidation } from '../middleware/validator';
import { encrypt, decrypt } from '../utils/encryption';
import { PRICING, ERROR_CODES } from '../config/constants';
import { WhatsAppApiClient } from '../services/whatsapp/apiClient';
import { TelegramNotifier } from '../services/telegram/notifier';
import logger from '../utils/logger';

const router = Router();

/**
 * Format account response
 */
function formatAccountResponse(account: any): AccountResponse {
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
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accounts = await db.account.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: accounts.map(formatAccountResponse),
    });
  } catch (error) {
    logger.error('List accounts failed', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to list accounts',
      },
    });
  }
});

/**
 * GET /api/accounts/:accountId
 * Get account details
 */
router.get(
  '/:accountId',
  authenticate,
  validate(accountValidation.getById),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const account = await db.account.findFirst({
        where: {
          id: req.params.accountId,
          userId: req.user!.userId,
        },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Account not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: formatAccountResponse(account),
      });
    } catch (error) {
      logger.error('Get account failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to get account',
        },
      });
    }
  }
);

/**
 * POST /api/accounts
 * Create new WhatsApp account
 */
router.post(
  '/',
  authenticate,
  validate(accountValidation.create),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { waBusinessId, waPhoneNumberId, waAccessToken, waPhoneNumber, accountName, monthlyBudget } = req.body;

      // Check account limits
      const user = await db.user.findUnique({
        where: { id: req.user!.userId },
        include: { accounts: true },
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

      const planLimits = PRICING[user.plan].limits;
      if (planLimits.accounts !== -1 && user.accounts.length >= planLimits.accounts) {
        res.status(403).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_LIMIT_REACHED,
            message: `Account limit reached. Upgrade to add more accounts. Current limit: ${planLimits.accounts}`,
          },
        });
        return;
      }

      // Check if business ID already exists
      const existingAccount = await db.account.findUnique({
        where: { waBusinessId },
      });

      if (existingAccount) {
        res.status(409).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
            message: 'This WhatsApp Business account is already connected',
          },
        });
        return;
      }

      // Verify the credentials
      try {
        const encryptedToken = encrypt(waAccessToken);
        const client = new WhatsAppApiClient(waPhoneNumberId, encryptedToken);
        const verification = await client.verifyPhoneNumber();

        // Create account
        const account = await db.account.create({
          data: {
            userId: req.user!.userId,
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
          const notifier = new TelegramNotifier();
          await notifier.sendAccountConnected(user.telegramId, accountName, waPhoneNumber);
        }

        logger.info('Account created', { userId: req.user!.userId, accountId: account.id });

        res.status(201).json({
          success: true,
          data: formatAccountResponse(account),
        });
      } catch (verifyError) {
        logger.error('WhatsApp verification failed', { error: verifyError });
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.WHATSAPP_API_ERROR,
            message: 'Failed to verify WhatsApp credentials. Please check your access token and phone number ID.',
          },
        });
      }
    } catch (error) {
      logger.error('Create account failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to create account',
        },
      });
    }
  }
);

/**
 * PATCH /api/accounts/:accountId
 * Update account
 */
router.patch(
  '/:accountId',
  authenticate,
  validate(accountValidation.update),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { accountId } = req.params;
      const updateData = req.body;

      // Verify ownership
      const existing = await db.account.findFirst({
        where: {
          id: accountId,
          userId: req.user!.userId,
        },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Account not found',
          },
        });
        return;
      }

      const account = await db.account.update({
        where: { id: accountId },
        data: updateData,
      });

      res.json({
        success: true,
        data: formatAccountResponse(account),
      });
    } catch (error) {
      logger.error('Update account failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to update account',
        },
      });
    }
  }
);

/**
 * DELETE /api/accounts/:accountId
 * Delete account
 */
router.delete(
  '/:accountId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { accountId } = req.params;

      const result = await db.account.deleteMany({
        where: {
          id: accountId,
          userId: req.user!.userId,
        },
      });

      if (result.count === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Account not found',
          },
        });
        return;
      }

      logger.info('Account deleted', { accountId });

      res.json({
        success: true,
        data: { message: 'Account deleted successfully' },
      });
    } catch (error) {
      logger.error('Delete account failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to delete account',
        },
      });
    }
  }
);

/**
 * POST /api/accounts/:accountId/sync
 * Trigger account sync
 */
router.post(
  '/:accountId/sync',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { accountId } = req.params;

      const account = await db.account.findFirst({
        where: {
          id: accountId,
          userId: req.user!.userId,
        },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Account not found',
          },
        });
        return;
      }

      // Import and run sync service
      const { MessageSyncService } = await import('../services/whatsapp/messageSync');
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
    } catch (error) {
      logger.error('Sync account failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to sync account',
        },
      });
    }
  }
);

/**
 * GET /api/accounts/:accountId/stats
 * Get account statistics
 */
router.get(
  '/:accountId/stats',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { accountId } = req.params;

      const account = await db.account.findFirst({
        where: {
          id: accountId,
          userId: req.user!.userId,
        },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Account not found',
          },
        });
        return;
      }

      // Get message counts
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalMessages, monthlyMessages, latestAnalysis] = await Promise.all([
        db.message.count({ where: { accountId } }),
        db.message.count({
          where: {
            accountId,
            timestamp: { gte: startOfMonth },
          },
        }),
        db.costAnalysis.findFirst({
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
    } catch (error) {
      logger.error('Get account stats failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to get account statistics',
        },
      });
    }
  }
);

export default router;
