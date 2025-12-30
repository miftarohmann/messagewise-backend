// =============================================================================
// MessageWise Optimizer - Webhook Routes
// =============================================================================

import { Router, Request, Response } from 'express';
import { WhatsAppWebhookHandler } from '../services/whatsapp/webhookHandler';
import { StripeService } from '../services/payment/stripe';
import { XenditService } from '../services/payment/xendit';
import { webhookRateLimiter } from '../middleware/rateLimiter';
import { ERROR_CODES } from '../config/constants';
import logger from '../utils/logger';

const router = Router();

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

/**
 * GET /api/webhooks/whatsapp
 * WhatsApp webhook verification
 */
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('WhatsApp webhook verification failed', { mode, token });
    res.status(403).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_FORBIDDEN,
        message: 'Verification failed',
      },
    });
  }
});

/**
 * POST /api/webhooks/whatsapp
 * WhatsApp webhook handler
 */
router.post(
  '/whatsapp',
  webhookRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Verify signature if app secret is configured
      if (WHATSAPP_APP_SECRET) {
        const signature = req.headers['x-hub-signature-256'] as string;
        const payload = JSON.stringify(req.body);

        if (!WhatsAppWebhookHandler.verifySignature(payload, signature, WHATSAPP_APP_SECRET)) {
          logger.warn('Invalid WhatsApp webhook signature');
          res.status(401).json({
            success: false,
            error: {
              code: ERROR_CODES.AUTH_UNAUTHORIZED,
              message: 'Invalid signature',
            },
          });
          return;
        }
      }

      // Acknowledge receipt immediately
      res.status(200).send('OK');

      // Process webhook asynchronously
      const handler = new WhatsAppWebhookHandler();
      await handler.processWebhook(req.body);
    } catch (error) {
      logger.error('WhatsApp webhook processing error', { error });
      // Still return 200 to prevent retries for processing errors
      if (!res.headersSent) {
        res.status(200).send('OK');
      }
    }
  }
);

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler
 */
router.post(
  '/stripe',
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;

      if (!signature) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_MISSING_FIELD,
            message: 'Missing signature',
          },
        });
        return;
      }

      const stripeService = new StripeService();
      const result = await stripeService.handleWebhook(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
        signature
      );

      if (result.success) {
        res.status(200).json({ received: true });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.STRIPE_ERROR,
            message: result.message,
          },
        });
      }
    } catch (error) {
      logger.error('Stripe webhook error', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Webhook processing failed',
        },
      });
    }
  }
);

/**
 * POST /api/webhooks/xendit
 * Xendit webhook handler (Indonesian payments)
 */
router.post(
  '/xendit',
  async (req: Request, res: Response) => {
    try {
      const callbackToken = req.headers['x-callback-token'] as string;

      if (!callbackToken) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_MISSING_FIELD,
            message: 'Missing callback token',
          },
        });
        return;
      }

      const xenditService = new XenditService();

      if (!xenditService.isActive()) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Xendit is not enabled',
          },
        });
        return;
      }

      const result = await xenditService.handleWebhook(req.body, callbackToken);

      if (result.success) {
        res.status(200).json({ received: true });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.XENDIT_ERROR,
            message: result.message,
          },
        });
      }
    } catch (error) {
      logger.error('Xendit webhook error', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Webhook processing failed',
        },
      });
    }
  }
);

/**
 * POST /api/webhooks/telegram
 * Telegram bot webhook (for account linking)
 */
router.post(
  '/telegram',
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      if (!message) {
        res.status(200).send('OK');
        return;
      }

      const chatId = message.chat.id;
      const text = message.text || '';

      // Handle /start command with link code
      if (text.startsWith('/start ')) {
        const linkCode = text.replace('/start ', '').trim();

        const { TelegramNotifier } = await import('../services/telegram/notifier');
        const { userId, valid } = TelegramNotifier.verifyLinkCode(linkCode);

        if (valid && userId) {
          // Link Telegram account to user
          const { db } = await import('../config/database');
          const user = await db.user.update({
            where: { id: userId },
            data: {
              telegramId: chatId.toString(),
              telegramUsername: message.from?.username,
              telegramNotifications: true,
            },
          });

          // Send welcome message
          const notifier = new TelegramNotifier();
          await notifier.sendWelcome(chatId.toString(), user.name || user.email);

          logger.info('Telegram account linked', { userId, chatId });
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Telegram webhook error', { error });
      res.status(200).send('OK'); // Always return 200 to Telegram
    }
  }
);

export default router;
