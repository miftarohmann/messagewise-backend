export declare const APP_NAME = "MessageWise";
export declare const APP_VERSION = "1.0.0";
export declare const API_VERSION = "v1";
export declare const PRICING: {
    readonly FREE: {
        readonly name: "Free";
        readonly price: 0;
        readonly priceIDR: 0;
        readonly currency: "USD";
        readonly accounts: 1;
        readonly messagesPerMonth: 1000;
        readonly limits: {
            readonly messagesPerMonth: 1000;
            readonly accounts: 1;
            readonly dataRetentionDays: 7;
            readonly apiAccess: false;
            readonly telegramAlerts: false;
            readonly exportReports: false;
            readonly crmIntegrations: false;
            readonly prioritySupport: false;
            readonly whiteLabel: false;
            readonly dedicatedSupport: false;
        };
    };
    readonly STARTER: {
        readonly name: "Starter";
        readonly price: 15;
        readonly priceIDR: 235000;
        readonly currency: "USD";
        readonly accounts: 3;
        readonly messagesPerMonth: 10000;
        readonly limits: {
            readonly messagesPerMonth: 10000;
            readonly accounts: 3;
            readonly dataRetentionDays: 30;
            readonly apiAccess: true;
            readonly telegramAlerts: true;
            readonly exportReports: true;
            readonly crmIntegrations: false;
            readonly prioritySupport: false;
            readonly whiteLabel: false;
            readonly dedicatedSupport: false;
        };
    };
    readonly PRO: {
        readonly name: "Pro";
        readonly price: 49;
        readonly priceIDR: 770000;
        readonly currency: "USD";
        readonly accounts: 10;
        readonly messagesPerMonth: 50000;
        readonly limits: {
            readonly messagesPerMonth: 50000;
            readonly accounts: 10;
            readonly dataRetentionDays: 90;
            readonly apiAccess: true;
            readonly telegramAlerts: true;
            readonly exportReports: true;
            readonly crmIntegrations: true;
            readonly prioritySupport: true;
            readonly whiteLabel: false;
            readonly dedicatedSupport: false;
        };
    };
    readonly ENTERPRISE: {
        readonly name: "Enterprise";
        readonly price: 199;
        readonly priceIDR: 3125000;
        readonly currency: "USD";
        readonly accounts: -1;
        readonly messagesPerMonth: -1;
        readonly limits: {
            readonly messagesPerMonth: -1;
            readonly accounts: -1;
            readonly dataRetentionDays: 365;
            readonly apiAccess: true;
            readonly telegramAlerts: true;
            readonly exportReports: true;
            readonly crmIntegrations: true;
            readonly prioritySupport: true;
            readonly whiteLabel: true;
            readonly dedicatedSupport: true;
        };
    };
};
export type PlanType = keyof typeof PRICING;
export declare const WA_PRICING: {
    readonly CATEGORIES: {
        readonly AUTHENTICATION: 0;
        readonly MARKETING: 0.0385;
        readonly UTILITY: 0.0042;
        readonly SERVICE: 0.0063;
    };
    readonly COUNTRY_RATES: {
        readonly ID: {
            readonly AUTHENTICATION: 0;
            readonly MARKETING: 0.0411;
            readonly UTILITY: 0.0019;
            readonly SERVICE: 0.0028;
        };
        readonly US: {
            readonly AUTHENTICATION: 0;
            readonly MARKETING: 0.025;
            readonly UTILITY: 0.004;
            readonly SERVICE: 0.006;
        };
        readonly IN: {
            readonly AUTHENTICATION: 0;
            readonly MARKETING: 0.0107;
            readonly UTILITY: 0.0014;
            readonly SERVICE: 0.0042;
        };
        readonly BR: {
            readonly AUTHENTICATION: 0;
            readonly MARKETING: 0.0625;
            readonly UTILITY: 0.0035;
            readonly SERVICE: 0.0315;
        };
    };
    readonly VOLUME_DISCOUNTS: {
        readonly TIER_1: {
            readonly min: 0;
            readonly max: 1000;
            readonly discount: 0;
        };
        readonly TIER_2: {
            readonly min: 1001;
            readonly max: 10000;
            readonly discount: 0.1;
        };
        readonly TIER_3: {
            readonly min: 10001;
            readonly max: 100000;
            readonly discount: 0.2;
        };
        readonly TIER_4: {
            readonly min: 100001;
            readonly max: number;
            readonly discount: 0.3;
        };
    };
    readonly FREE_TIER: {
        readonly conversationsPerMonth: 1000;
        readonly description: "First 1000 service conversations per month are free";
    };
    readonly SERVICE_WINDOW: {
        readonly durationHours: 24;
        readonly description: "Free unlimited messages within 24h of customer contact";
    };
};
export declare const RATE_LIMITS: {
    readonly FREE: {
        readonly requestsPerWindow: 100;
        readonly windowMs: number;
    };
    readonly STARTER: {
        readonly requestsPerWindow: 500;
        readonly windowMs: number;
    };
    readonly PRO: {
        readonly requestsPerWindow: 2000;
        readonly windowMs: number;
    };
    readonly ENTERPRISE: {
        readonly requestsPerWindow: 10000;
        readonly windowMs: number;
    };
};
export declare const CLASSIFICATION_KEYWORDS: {
    readonly AUTHENTICATION: readonly ["otp", "verification code", "verify", "kode verifikasi", "authentication", "confirm", "konfirmasi", "security code", "kode keamanan", "one-time password", "kode otp", "2fa", "two-factor", "login code", "kode login", "reset password", "activation code", "kode aktivasi"];
    readonly MARKETING: readonly ["promo", "discount", "sale", "offer", "deals", "diskon", "special offer", "limited time", "buy now", "shop now", "newsletter", "announcement", "launching", "new product", "flash sale", "gratis", "free shipping", "exclusive", "penawaran", "promosi", "hemat", "cashback", "voucher", "kupon", "coupon", "subscribe", "langganan", "campaign"];
    readonly UTILITY: readonly ["order", "receipt", "invoice", "payment", "transaction", "pesanan", "pembayaran", "transaksi", "ticket", "booking", "confirmation", "status update", "shipping", "delivery", "pengiriman", "tracking", "lacak", "invoice number", "nomor faktur", "appointment", "jadwal", "schedule", "reminder", "pengingat", "billing", "tagihan", "statement", "resi", "awb"];
    readonly SERVICE: readonly ["help", "bantuan", "support", "question", "pertanyaan", "inquiry", "feedback", "complaint", "keluhan", "issue", "masalah", "problem", "request", "permintaan", "information", "informasi", "thank you", "terima kasih", "customer service", "layanan pelanggan"];
};
export declare const TIME: {
    readonly MS_PER_SECOND: 1000;
    readonly MS_PER_MINUTE: number;
    readonly MS_PER_HOUR: number;
    readonly MS_PER_DAY: number;
    readonly SERVICE_WINDOW_HOURS: 24;
    readonly JWT_EXPIRY: "7d";
    readonly REFRESH_TOKEN_EXPIRY: "30d";
    readonly API_KEY_EXPIRY_DAYS: 365;
};
export declare const ERROR_CODES: {
    readonly AUTH_INVALID_CREDENTIALS: "AUTH_1001";
    readonly AUTH_TOKEN_EXPIRED: "AUTH_1002";
    readonly AUTH_TOKEN_INVALID: "AUTH_1003";
    readonly AUTH_UNAUTHORIZED: "AUTH_1004";
    readonly AUTH_FORBIDDEN: "AUTH_1005";
    readonly VALIDATION_FAILED: "VAL_2001";
    readonly VALIDATION_MISSING_FIELD: "VAL_2002";
    readonly VALIDATION_INVALID_FORMAT: "VAL_2003";
    readonly RESOURCE_NOT_FOUND: "RES_3001";
    readonly RESOURCE_ALREADY_EXISTS: "RES_3002";
    readonly RESOURCE_LIMIT_REACHED: "RES_3003";
    readonly WHATSAPP_API_ERROR: "WA_4001";
    readonly TELEGRAM_API_ERROR: "TG_4002";
    readonly STRIPE_ERROR: "PAY_4003";
    readonly XENDIT_ERROR: "PAY_4004";
    readonly INTERNAL_ERROR: "SRV_5001";
    readonly DATABASE_ERROR: "SRV_5002";
    readonly CACHE_ERROR: "SRV_5003";
};
export declare const WEBHOOK_EVENTS: {
    readonly MESSAGE_RECEIVED: "message.received";
    readonly MESSAGE_SENT: "message.sent";
    readonly MESSAGE_DELIVERED: "message.delivered";
    readonly MESSAGE_READ: "message.read";
    readonly MESSAGE_FAILED: "message.failed";
    readonly ANALYSIS_COMPLETED: "analysis.completed";
    readonly RECOMMENDATION_GENERATED: "recommendation.generated";
    readonly ALERT_COST_SPIKE: "alert.cost_spike";
    readonly ALERT_BUDGET_WARNING: "alert.budget_warning";
    readonly ALERT_BUDGET_EXCEEDED: "alert.budget_exceeded";
    readonly ACCOUNT_CONNECTED: "account.connected";
    readonly ACCOUNT_DISCONNECTED: "account.disconnected";
    readonly ACCOUNT_SYNC_COMPLETED: "account.sync_completed";
};
//# sourceMappingURL=constants.d.ts.map