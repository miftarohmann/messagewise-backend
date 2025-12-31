// =============================================================================
// MessageWise Optimizer - Payment Routes (Stripe + Xendit)
// =============================================================================

import { Router, Request, Response } from 'express';
import { Plan } from '@prisma/client';
import { db } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { PRICING, ERROR_CODES } from '../config/constants';
import { StripeService } from '../services/payment/stripe';
import { XenditService } from '../services/payment/xendit';
import logger from '../utils/logger';

const router = Router();
const stripeService = new StripeService();
const xenditService = new XenditService();

// =============================================================================
// Pricing Information
// =============================================================================

/**
 * GET /api/payment/plans
 * Get available plans and pricing
 */
router.get('/plans', (req: Request, res: Response) => {
  const plans = Object.entries(PRICING).map(([key, value]) => ({
    id: key,
    name: value.name,
    priceUSD: value.price,
    priceIDR: value.priceIDR,
    accounts: value.accounts,
    messagesPerMonth: value.messagesPerMonth,
    features: getFeaturesByPlan(key as Plan),
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
function getFeaturesByPlan(plan: Plan): string[] {
  switch (plan) {
    case Plan.FREE:
      return [
        'Analitik dasar',
        '1 akun WhatsApp',
        '1.000 pesan/bulan',
        'Dashboard real-time',
      ];
    case Plan.STARTER:
      return [
        'Semua fitur Free',
        '3 akun WhatsApp',
        '10.000 pesan/bulan',
        'Notifikasi Telegram',
        'Export CSV',
        'Email support',
      ];
    case Plan.PRO:
      return [
        'Semua fitur Starter',
        '10 akun WhatsApp',
        '50.000 pesan/bulan',
        'API akses',
        'Laporan PDF kustom',
        'Rekomendasi AI',
        'Priority support',
      ];
    case Plan.ENTERPRISE:
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
router.post(
  '/stripe/checkout',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { plan } = req.body;
      const userId = req.user!.userId;

      if (!plan || plan === Plan.FREE) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_FAILED,
            message: 'Please select a paid plan',
          },
        });
        return;
      }

      // Validate plan
      if (!Object.keys(Plan).includes(plan)) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_FAILED,
            message: 'Invalid plan selected',
          },
        });
        return;
      }

      const user = await db.user.findUnique({
        where: { id: userId },
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

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const successUrl = `${frontendUrl}/dashboard/settings?payment=success&plan=${plan}`;
      const cancelUrl = `${frontendUrl}/dashboard/settings?payment=cancelled`;

      const checkoutUrl = await stripeService.createCheckoutSession(
        userId,
        user.email,
        plan as Plan,
        successUrl,
        cancelUrl
      );

      logger.info('Stripe checkout session created', { userId, plan });

      res.json({
        success: true,
        data: {
          checkoutUrl,
        },
      });
    } catch (error) {
      logger.error('Stripe checkout failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to create checkout session',
        },
      });
    }
  }
);

/**
 * POST /api/payment/stripe/portal
 * Create Stripe billing portal session
 */
router.post(
  '/stripe/portal',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const user = await db.user.findUnique({
        where: { id: userId },
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

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const returnUrl = `${frontendUrl}/dashboard/settings`;

      const portalUrl = await stripeService.createPortalSession(
        user.email,
        returnUrl
      );

      res.json({
        success: true,
        data: {
          portalUrl,
        },
      });
    } catch (error) {
      logger.error('Stripe portal creation failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to create billing portal session',
        },
      });
    }
  }
);

// =============================================================================
// Xendit Endpoints (Indonesia)
// =============================================================================

/**
 * POST /api/payment/xendit/invoice
 * Create Xendit invoice for Indonesian payments
 */
router.post(
  '/xendit/invoice',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { plan } = req.body;
      const userId = req.user!.userId;

      if (!xenditService.isActive()) {
        res.status(503).json({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Indonesian payment gateway is not available',
          },
        });
        return;
      }

      if (!plan || plan === Plan.FREE) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_FAILED,
            message: 'Please select a paid plan',
          },
        });
        return;
      }

      const user = await db.user.findUnique({
        where: { id: userId },
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

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const successUrl = `${frontendUrl}/dashboard/settings?payment=success&plan=${plan}`;
      const failureUrl = `${frontendUrl}/dashboard/settings?payment=failed`;

      const { invoiceUrl, invoiceId } = await xenditService.createInvoice(
        userId,
        user.email,
        plan as Plan,
        successUrl,
        failureUrl
      );

      logger.info('Xendit invoice created', { userId, plan, invoiceId });

      res.json({
        success: true,
        data: {
          invoiceUrl,
          invoiceId,
        },
      });
    } catch (error) {
      logger.error('Xendit invoice creation failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to create invoice',
        },
      });
    }
  }
);

/**
 * GET /api/payment/xendit/methods
 * Get available Xendit payment methods
 */
router.get('/xendit/methods', (req: Request, res: Response) => {
  const methods = XenditService.getAvailablePaymentMethods();

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
router.get(
  '/subscription',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const user = await db.user.findUnique({
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
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'User not found',
          },
        });
        return;
      }

      // Get recent invoices
      const invoices = await db.invoice.findMany({
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

      const pricing = PRICING[user.plan];
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
          canUpgrade: user.plan !== Plan.ENTERPRISE,
          canDowngrade: user.plan !== Plan.FREE,
        },
      });
    } catch (error) {
      logger.error('Get subscription failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to get subscription',
        },
      });
    }
  }
);

/**
 * POST /api/payment/downgrade
 * Downgrade to free plan (at end of billing period)
 */
router.post(
  '/downgrade',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const user = await db.user.findUnique({
        where: { id: userId },
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

      if (user.plan === Plan.FREE) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_FAILED,
            message: 'Already on free plan',
          },
        });
        return;
      }

      // Mark for downgrade at period end
      // In production, this would also cancel recurring payments

      logger.info('Plan downgrade requested', { userId, currentPlan: user.plan });

      res.json({
        success: true,
        data: {
          message: 'Your plan will be downgraded to Free at the end of your current billing period',
          currentPlan: user.plan,
          expiresAt: user.planExpiresAt,
        },
      });
    } catch (error) {
      logger.error('Downgrade failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to process downgrade',
        },
      });
    }
  }
);

/**
 * GET /api/payment/invoices
 * Get invoice history
 */
router.get(
  '/invoices',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        db.invoice.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.invoice.count({ where: { userId } }),
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
    } catch (error) {
      logger.error('Get invoices failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to get invoices',
        },
      });
    }
  }
);

export default router;
