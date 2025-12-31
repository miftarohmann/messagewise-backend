"use strict";
// =============================================================================
// MessageWise Optimizer - Webhook Routes
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
const webhookHandler_1 = require("../services/whatsapp/webhookHandler");
const stripe_1 = require("../services/payment/stripe");
const xendit_1 = require("../services/payment/xendit");
const rateLimiter_1 = require("../middleware/rateLimiter");
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
/**
 * GET /api/webhooks/whatsapp
 * WhatsApp webhook verification
 */
router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        logger_1.default.info('WhatsApp webhook verified');
        res.status(200).send(challenge);
    }
    else {
        logger_1.default.warn('WhatsApp webhook verification failed', { mode, token });
        res.status(403).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.AUTH_FORBIDDEN,
                message: 'Verification failed',
            },
        });
    }
});
/**
 * POST /api/webhooks/whatsapp
 * WhatsApp webhook handler
 */
router.post('/whatsapp', rateLimiter_1.webhookRateLimiter, async (req, res) => {
    try {
        // Verify signature if app secret is configured
        if (WHATSAPP_APP_SECRET) {
            const signature = req.headers['x-hub-signature-256'];
            const payload = JSON.stringify(req.body);
            if (!webhookHandler_1.WhatsAppWebhookHandler.verifySignature(payload, signature, WHATSAPP_APP_SECRET)) {
                logger_1.default.warn('Invalid WhatsApp webhook signature');
                res.status(401).json({
                    success: false,
                    error: {
                        code: constants_1.ERROR_CODES.AUTH_UNAUTHORIZED,
                        message: 'Invalid signature',
                    },
                });
                return;
            }
        }
        // Acknowledge receipt immediately
        res.status(200).send('OK');
        // Process webhook asynchronously
        const handler = new webhookHandler_1.WhatsAppWebhookHandler();
        await handler.processWebhook(req.body);
    }
    catch (error) {
        logger_1.default.error('WhatsApp webhook processing error', { error });
        // Still return 200 to prevent retries for processing errors
        if (!res.headersSent) {
            res.status(200).send('OK');
        }
    }
});
/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler
 */
router.post('/stripe', async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        const payload = req.body;
        if (!signature) {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.VALIDATION_MISSING_FIELD,
                    message: 'Missing signature',
                },
            });
            return;
        }
        const stripeService = new stripe_1.StripeService();
        const result = await stripeService.handleWebhook(typeof payload === 'string' ? payload : JSON.stringify(payload), signature);
        if (result.success) {
            res.status(200).json({ received: true });
        }
        else {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.STRIPE_ERROR,
                    message: result.message,
                },
            });
        }
    }
    catch (error) {
        logger_1.default.error('Stripe webhook error', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Webhook processing failed',
            },
        });
    }
});
/**
 * POST /api/webhooks/xendit
 * Xendit webhook handler (Indonesian payments)
 */
router.post('/xendit', async (req, res) => {
    try {
        const callbackToken = req.headers['x-callback-token'];
        if (!callbackToken) {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.VALIDATION_MISSING_FIELD,
                    message: 'Missing callback token',
                },
            });
            return;
        }
        const xenditService = new xendit_1.XenditService();
        if (!xenditService.isActive()) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Xendit is not enabled',
                },
            });
            return;
        }
        const result = await xenditService.handleWebhook(req.body, callbackToken);
        if (result.success) {
            res.status(200).json({ received: true });
        }
        else {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.XENDIT_ERROR,
                    message: result.message,
                },
            });
        }
    }
    catch (error) {
        logger_1.default.error('Xendit webhook error', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Webhook processing failed',
            },
        });
    }
});
/**
 * POST /api/webhooks/telegram
 * Telegram bot webhook (for account linking)
 */
router.post('/telegram', async (req, res) => {
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
            const { TelegramNotifier } = await Promise.resolve().then(() => __importStar(require('../services/telegram/notifier')));
            const { userId, valid } = TelegramNotifier.verifyLinkCode(linkCode);
            if (valid && userId) {
                // Link Telegram account to user
                const { db } = await Promise.resolve().then(() => __importStar(require('../config/database')));
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
                logger_1.default.info('Telegram account linked', { userId, chatId });
            }
        }
        res.status(200).send('OK');
    }
    catch (error) {
        logger_1.default.error('Telegram webhook error', { error });
        res.status(200).send('OK'); // Always return 200 to Telegram
    }
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map