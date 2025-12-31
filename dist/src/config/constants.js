"use strict";
// =============================================================================
// MessageWise Optimizer - Application Constants
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBHOOK_EVENTS = exports.ERROR_CODES = exports.TIME = exports.CLASSIFICATION_KEYWORDS = exports.RATE_LIMITS = exports.WA_PRICING = exports.PRICING = exports.API_VERSION = exports.APP_VERSION = exports.APP_NAME = void 0;
exports.APP_NAME = 'MessageWise';
exports.APP_VERSION = '1.0.0';
exports.API_VERSION = 'v1';
// =============================================================================
// Pricing Configuration
// =============================================================================
exports.PRICING = {
    FREE: {
        name: 'Free',
        price: 0,
        priceIDR: 0,
        currency: 'USD',
        accounts: 1,
        messagesPerMonth: 1000,
        limits: {
            messagesPerMonth: 1000,
            accounts: 1,
            dataRetentionDays: 7,
            apiAccess: false,
            telegramAlerts: false,
            exportReports: false,
            crmIntegrations: false,
            prioritySupport: false,
            whiteLabel: false,
            dedicatedSupport: false,
        },
    },
    STARTER: {
        name: 'Starter',
        price: 15,
        priceIDR: 235000,
        currency: 'USD',
        accounts: 3,
        messagesPerMonth: 10000,
        limits: {
            messagesPerMonth: 10000,
            accounts: 3,
            dataRetentionDays: 30,
            apiAccess: true,
            telegramAlerts: true,
            exportReports: true,
            crmIntegrations: false,
            prioritySupport: false,
            whiteLabel: false,
            dedicatedSupport: false,
        },
    },
    PRO: {
        name: 'Pro',
        price: 49,
        priceIDR: 770000,
        currency: 'USD',
        accounts: 10,
        messagesPerMonth: 50000,
        limits: {
            messagesPerMonth: 50000,
            accounts: 10,
            dataRetentionDays: 90,
            apiAccess: true,
            telegramAlerts: true,
            exportReports: true,
            crmIntegrations: true,
            prioritySupport: true,
            whiteLabel: false,
            dedicatedSupport: false,
        },
    },
    ENTERPRISE: {
        name: 'Enterprise',
        price: 199,
        priceIDR: 3125000,
        currency: 'USD',
        accounts: -1,
        messagesPerMonth: -1,
        limits: {
            messagesPerMonth: -1, // Unlimited
            accounts: -1, // Unlimited
            dataRetentionDays: 365,
            apiAccess: true,
            telegramAlerts: true,
            exportReports: true,
            crmIntegrations: true,
            prioritySupport: true,
            whiteLabel: true,
            dedicatedSupport: true,
        },
    },
};
// =============================================================================
// WhatsApp API Pricing (Meta rates as of 2025)
// =============================================================================
exports.WA_PRICING = {
    // Message category pricing (per message, in USD)
    // Rates vary by country - these are approximate/average rates
    CATEGORIES: {
        AUTHENTICATION: 0, // Free
        MARKETING: 0.0385, // Promotional messages
        UTILITY: 0.0042, // Transactional messages
        SERVICE: 0.0063, // Customer service
    },
    // Country-specific rates (examples)
    COUNTRY_RATES: {
        ID: {
            // Indonesia
            AUTHENTICATION: 0,
            MARKETING: 0.0411,
            UTILITY: 0.0019,
            SERVICE: 0.0028,
        },
        US: {
            // United States
            AUTHENTICATION: 0,
            MARKETING: 0.025,
            UTILITY: 0.004,
            SERVICE: 0.006,
        },
        IN: {
            // India
            AUTHENTICATION: 0,
            MARKETING: 0.0107,
            UTILITY: 0.0014,
            SERVICE: 0.0042,
        },
        BR: {
            // Brazil
            AUTHENTICATION: 0,
            MARKETING: 0.0625,
            UTILITY: 0.0035,
            SERVICE: 0.0315,
        },
    },
    // Volume-based conversation discounts
    VOLUME_DISCOUNTS: {
        TIER_1: { min: 0, max: 1000, discount: 0 }, // 0% discount
        TIER_2: { min: 1001, max: 10000, discount: 0.1 }, // 10% discount
        TIER_3: { min: 10001, max: 100000, discount: 0.2 }, // 20% discount
        TIER_4: { min: 100001, max: Infinity, discount: 0.3 }, // 30% discount
    },
    // Free tier allowance
    FREE_TIER: {
        conversationsPerMonth: 1000,
        description: 'First 1000 service conversations per month are free',
    },
    // 24-hour service window
    SERVICE_WINDOW: {
        durationHours: 24,
        description: 'Free unlimited messages within 24h of customer contact',
    },
};
// =============================================================================
// API Rate Limits
// =============================================================================
exports.RATE_LIMITS = {
    // Per plan rate limits (requests per 15 minutes)
    FREE: {
        requestsPerWindow: 100,
        windowMs: 15 * 60 * 1000,
    },
    STARTER: {
        requestsPerWindow: 500,
        windowMs: 15 * 60 * 1000,
    },
    PRO: {
        requestsPerWindow: 2000,
        windowMs: 15 * 60 * 1000,
    },
    ENTERPRISE: {
        requestsPerWindow: 10000,
        windowMs: 15 * 60 * 1000,
    },
};
// =============================================================================
// Message Classification Keywords
// =============================================================================
exports.CLASSIFICATION_KEYWORDS = {
    AUTHENTICATION: [
        'otp',
        'verification code',
        'verify',
        'kode verifikasi',
        'authentication',
        'confirm',
        'konfirmasi',
        'security code',
        'kode keamanan',
        'one-time password',
        'kode otp',
        '2fa',
        'two-factor',
        'login code',
        'kode login',
        'reset password',
        'activation code',
        'kode aktivasi',
    ],
    MARKETING: [
        'promo',
        'discount',
        'sale',
        'offer',
        'deals',
        'diskon',
        'special offer',
        'limited time',
        'buy now',
        'shop now',
        'newsletter',
        'announcement',
        'launching',
        'new product',
        'flash sale',
        'gratis',
        'free shipping',
        'exclusive',
        'penawaran',
        'promosi',
        'hemat',
        'cashback',
        'voucher',
        'kupon',
        'coupon',
        'subscribe',
        'langganan',
        'campaign',
    ],
    UTILITY: [
        'order',
        'receipt',
        'invoice',
        'payment',
        'transaction',
        'pesanan',
        'pembayaran',
        'transaksi',
        'ticket',
        'booking',
        'confirmation',
        'status update',
        'shipping',
        'delivery',
        'pengiriman',
        'tracking',
        'lacak',
        'invoice number',
        'nomor faktur',
        'appointment',
        'jadwal',
        'schedule',
        'reminder',
        'pengingat',
        'billing',
        'tagihan',
        'statement',
        'resi',
        'awb',
    ],
    SERVICE: [
        'help',
        'bantuan',
        'support',
        'question',
        'pertanyaan',
        'inquiry',
        'feedback',
        'complaint',
        'keluhan',
        'issue',
        'masalah',
        'problem',
        'request',
        'permintaan',
        'information',
        'informasi',
        'thank you',
        'terima kasih',
        'customer service',
        'layanan pelanggan',
    ],
};
// =============================================================================
// Time Constants
// =============================================================================
exports.TIME = {
    MS_PER_SECOND: 1000,
    MS_PER_MINUTE: 60 * 1000,
    MS_PER_HOUR: 60 * 60 * 1000,
    MS_PER_DAY: 24 * 60 * 60 * 1000,
    SERVICE_WINDOW_HOURS: 24,
    JWT_EXPIRY: '7d',
    REFRESH_TOKEN_EXPIRY: '30d',
    API_KEY_EXPIRY_DAYS: 365,
};
// =============================================================================
// Error Codes
// =============================================================================
exports.ERROR_CODES = {
    // Authentication errors (1xxx)
    AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
    AUTH_TOKEN_EXPIRED: 'AUTH_1002',
    AUTH_TOKEN_INVALID: 'AUTH_1003',
    AUTH_UNAUTHORIZED: 'AUTH_1004',
    AUTH_FORBIDDEN: 'AUTH_1005',
    // Validation errors (2xxx)
    VALIDATION_FAILED: 'VAL_2001',
    VALIDATION_MISSING_FIELD: 'VAL_2002',
    VALIDATION_INVALID_FORMAT: 'VAL_2003',
    // Resource errors (3xxx)
    RESOURCE_NOT_FOUND: 'RES_3001',
    RESOURCE_ALREADY_EXISTS: 'RES_3002',
    RESOURCE_LIMIT_REACHED: 'RES_3003',
    // External service errors (4xxx)
    WHATSAPP_API_ERROR: 'WA_4001',
    TELEGRAM_API_ERROR: 'TG_4002',
    STRIPE_ERROR: 'PAY_4003',
    XENDIT_ERROR: 'PAY_4004',
    // Server errors (5xxx)
    INTERNAL_ERROR: 'SRV_5001',
    DATABASE_ERROR: 'SRV_5002',
    CACHE_ERROR: 'SRV_5003',
};
// =============================================================================
// Webhook Events
// =============================================================================
exports.WEBHOOK_EVENTS = {
    // WhatsApp events
    MESSAGE_RECEIVED: 'message.received',
    MESSAGE_SENT: 'message.sent',
    MESSAGE_DELIVERED: 'message.delivered',
    MESSAGE_READ: 'message.read',
    MESSAGE_FAILED: 'message.failed',
    // Analysis events
    ANALYSIS_COMPLETED: 'analysis.completed',
    RECOMMENDATION_GENERATED: 'recommendation.generated',
    // Alert events
    ALERT_COST_SPIKE: 'alert.cost_spike',
    ALERT_BUDGET_WARNING: 'alert.budget_warning',
    ALERT_BUDGET_EXCEEDED: 'alert.budget_exceeded',
    // Account events
    ACCOUNT_CONNECTED: 'account.connected',
    ACCOUNT_DISCONNECTED: 'account.disconnected',
    ACCOUNT_SYNC_COMPLETED: 'account.sync_completed',
};
//# sourceMappingURL=constants.js.map