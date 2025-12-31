"use strict";
// =============================================================================
// MessageWise Optimizer - Payment Routes (Stripe + Xendit)
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const constants_1 = require("../config/constants");
const stripe_1 = require("../services/payment/stripe");
const xendit_1 = require("../services/payment/xendit");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
const stripeService = new stripe_1.StripeService();
const xenditService = new xendit_1.XenditService();
// =============================================================================
// Pricing Information
// =============================================================================
/**
 * GET /api/payment/plans
 * Get available plans and pricing
 */
router.get('/plans', (req, res) => {
    const plans = Object.entries(constants_1.PRICING).map(([key, value]) => ({
        id: key,
        name: value.name,
        priceUSD: value.price,
        priceIDR: value.priceIDR,
        accounts: value.accounts,
        messagesPerMonth: value.messagesPerMonth,
        features: getFeaturesByPlan(key),
    }));
    res.json({
        success: true,
        data: {
            plans,
            currency: {
                usd: 'USD',
                idr: 'IDR',
            },
            paymentMethods: {
                international: ['stripe'],
                indonesia: ['xendit'],
            },
        },
    });
});
/**
 * Get features by plan
 */
function getFeaturesByPlan(plan) {
    switch (plan) {
        case client_1.Plan.FREE:
            return [
                'Analitik dasar',
                '1 akun WhatsApp',
                '1.000 pesan/bulan',
                'Dashboard real-time',
            ];
        case client_1.Plan.STARTER:
            return [
                'Semua fitur Free',
                '3 akun WhatsApp',
                '10.000 pesan/bulan',
                'Notifikasi Telegram',
                'Export CSV',
                'Email support',
            ];
        case client_1.Plan.PRO:
            return [
                'Semua fitur Starter',
                '10 akun WhatsApp',
                '50.000 pesan/bulan',
                'API akses',
                'Laporan PDF kustom',
                'Rekomendasi AI',
                'Priority support',
            ];
        case client_1.Plan.ENTERPRISE:
            return [
                'Semua fitur Pro',
                'Unlimited akun',
                'Unlimited pesan',
                'Dedicated account manager',
                'Custom integration',
                'SLA guarantee',
                'White-label option',
            ];
        default:
            return [];
    }
}
// =============================================================================
// Stripe Endpoints (International)
// =============================================================================
/**
 * POST /api/payment/stripe/checkout
 * Create Stripe checkout session
 */
router.post('/stripe/checkout', auth_1.authenticate, async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.userId;
        if (!plan || plan === client_1.Plan.FREE) {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.VALIDATION_FAILED,
                    message: 'Please select a paid plan',
                },
            });
            return;
        }
        // Validate plan
        if (!Object.keys(client_1.Plan).includes(plan)) {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.VALIDATION_FAILED,
                    message: 'Invalid plan selected',
                },
            });
            return;
        }
        const user = await database_1.db.user.findUnique({
            where: { id: userId },
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
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/dashboard/settings?payment=success&plan=${plan}`;
        const cancelUrl = `${frontendUrl}/dashboard/settings?payment=cancelled`;
        const checkoutUrl = await stripeService.createCheckoutSession(userId, user.email, plan, successUrl, cancelUrl);
        logger_1.default.info('Stripe checkout session created', { userId, plan });
        res.json({
            success: true,
            data: {
                checkoutUrl,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Stripe checkout failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create checkout session',
            },
        });
    }
});
/**
 * POST /api/payment/stripe/portal
 * Create Stripe billing portal session
 */
router.post('/stripe/portal', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await database_1.db.user.findUnique({
            where: { id: userId },
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
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const returnUrl = `${frontendUrl}/dashboard/settings`;
        const portalUrl = await stripeService.createPortalSession(user.email, returnUrl);
        res.json({
            success: true,
            data: {
                portalUrl,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Stripe portal creation failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create billing portal session',
            },
        });
    }
});
// =============================================================================
// Xendit Endpoints (Indonesia)
// =============================================================================
/**
 * POST /api/payment/xendit/invoice
 * Create Xendit invoice for Indonesian payments
 */
router.post('/xendit/invoice', auth_1.authenticate, async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.userId;
        if (!xenditService.isActive()) {
            res.status(503).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                    message: 'Indonesian payment gateway is not available',
                },
            });
            return;
        }
        if (!plan || plan === client_1.Plan.FREE) {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.VALIDATION_FAILED,
                    message: 'Please select a paid plan',
                },
            });
            return;
        }
        const user = await database_1.db.user.findUnique({
            where: { id: userId },
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
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/dashboard/settings?payment=success&plan=${plan}`;
        const failureUrl = `${frontendUrl}/dashboard/settings?payment=failed`;
        const { invoiceUrl, invoiceId } = await xenditService.createInvoice(userId, user.email, plan, successUrl, failureUrl);
        logger_1.default.info('Xendit invoice created', { userId, plan, invoiceId });
        res.json({
            success: true,
            data: {
                invoiceUrl,
                invoiceId,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Xendit invoice creation failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create invoice',
            },
        });
    }
});
/**
 * GET /api/payment/xendit/methods
 * Get available Xendit payment methods
 */
router.get('/xendit/methods', (req, res) => {
    const methods = xendit_1.XenditService.getAvailablePaymentMethods();
    res.json({
        success: true,
        data: {
            methods,
            grouped: {
                bank_transfer: methods.filter(m => m.type === 'bank_transfer'),
                ewallet: methods.filter(m => m.type === 'ewallet'),
                retail: methods.filter(m => m.type === 'retail'),
                qr: methods.filter(m => m.type === 'qr'),
                card: methods.filter(m => m.type === 'card'),
            },
        },
    });
});
// =============================================================================
// Subscription Management
// =============================================================================
/**
 * GET /api/payment/subscription
 * Get current subscription status
 */
router.get('/subscription', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await database_1.db.user.findUnique({
            where: { id: userId },
            select: {
                plan: true,
                planExpiresAt: true,
            },
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
        // Get recent invoices
        const invoices = await database_1.db.invoice.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                invoiceNumber: true,
                amount: true,
                currency: true,
                status: true,
                plan: true,
                gateway: true,
                periodStart: true,
                periodEnd: true,
                paidAt: true,
                createdAt: true,
            },
        });
        const pricing = constants_1.PRICING[user.plan];
        const isExpired = user.planExpiresAt && user.planExpiresAt < new Date();
        res.json({
            success: true,
            data: {
                currentPlan: {
                    id: user.plan,
                    name: pricing.name,
                    priceUSD: pricing.price,
                    priceIDR: pricing.priceIDR,
                    expiresAt: user.planExpiresAt,
                    isExpired,
                    features: getFeaturesByPlan(user.plan),
                },
                invoices,
                canUpgrade: user.plan !== client_1.Plan.ENTERPRISE,
                canDowngrade: user.plan !== client_1.Plan.FREE,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get subscription failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get subscription',
            },
        });
    }
});
/**
 * POST /api/payment/downgrade
 * Downgrade to free plan (at end of billing period)
 */
router.post('/downgrade', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await database_1.db.user.findUnique({
            where: { id: userId },
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
        if (user.plan === client_1.Plan.FREE) {
            res.status(400).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.VALIDATION_FAILED,
                    message: 'Already on free plan',
                },
            });
            return;
        }
        // Mark for downgrade at period end
        // In production, this would also cancel recurring payments
        logger_1.default.info('Plan downgrade requested', { userId, currentPlan: user.plan });
        res.json({
            success: true,
            data: {
                message: 'Your plan will be downgraded to Free at the end of your current billing period',
                currentPlan: user.plan,
                expiresAt: user.planExpiresAt,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Downgrade failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to process downgrade',
            },
        });
    }
});
/**
 * GET /api/payment/invoices
 * Get invoice history
 */
router.get('/invoices', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [invoices, total] = await Promise.all([
            database_1.db.invoice.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.db.invoice.count({ where: { userId } }),
        ]);
        res.json({
            success: true,
            data: {
                invoices,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get invoices failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get invoices',
            },
        });
    }
});
exports.default = router;
//# sourceMappingURL=payment.js.map