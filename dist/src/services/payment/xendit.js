"use strict";
// =============================================================================
// MessageWise Optimizer - Xendit Payment Integration (Indonesian Payments)
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XenditService = void 0;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const database_1 = require("../../config/database");
const constants_1 = require("../../config/constants");
const logger_1 = __importDefault(require("../../utils/logger"));
class XenditService {
    client;
    isEnabled;
    constructor() {
        this.isEnabled = process.env.ENABLE_XENDIT === 'true';
        const secretKey = process.env.XENDIT_SECRET_KEY || '';
        this.client = axios_1.default.create({
            baseURL: 'https://api.xendit.co',
            headers: {
                'Content-Type': 'application/json',
            },
            auth: {
                username: secretKey,
                password: '',
            },
        });
    }
    /**
     * Check if Xendit is enabled
     */
    isActive() {
        return this.isEnabled;
    }
    /**
     * Create an invoice for subscription
     */
    async createInvoice(userId, email, plan, successUrl, failureUrl) {
        if (!this.isActive()) {
            throw new Error('Xendit payments are not enabled');
        }
        if (plan === client_1.Plan.FREE) {
            throw new Error('Cannot create invoice for free plan');
        }
        const pricing = constants_1.PRICING[plan];
        const externalId = `mw_${userId}_${plan}_${Date.now()}`;
        try {
            const response = await this.client.post('/v2/invoices', {
                external_id: externalId,
                amount: pricing.priceIDR,
                currency: 'IDR',
                payer_email: email,
                description: `MessageWise ${pricing.name} Plan - Monthly Subscription`,
                success_redirect_url: successUrl,
                failure_redirect_url: failureUrl,
                invoice_duration: 86400, // 24 hours
                customer: {
                    email,
                },
                items: [
                    {
                        name: `${pricing.name} Plan`,
                        quantity: 1,
                        price: pricing.priceIDR,
                    },
                ],
                fees: [],
                payment_methods: [
                    'CREDIT_CARD',
                    'BCA',
                    'BNI',
                    'BRI',
                    'MANDIRI',
                    'PERMATA',
                    'ALFAMART',
                    'INDOMARET',
                    'OVO',
                    'DANA',
                    'LINKAJA',
                    'SHOPEEPAY',
                    'QRIS',
                ],
            });
            // Store invoice in database
            await database_1.db.invoice.create({
                data: {
                    userId,
                    invoiceNumber: externalId,
                    amount: pricing.priceIDR,
                    currency: client_1.Currency.IDR,
                    status: client_1.InvoiceStatus.PENDING,
                    gateway: client_1.PaymentGateway.XENDIT,
                    gatewayId: response.data.id,
                    gatewayData: JSON.parse(JSON.stringify(response.data)),
                    plan,
                    periodStart: new Date(),
                    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    dueDate: new Date(response.data.expiry_date),
                },
            });
            logger_1.default.info('Xendit invoice created', {
                invoiceId: response.data.id,
                userId,
                plan,
            });
            return {
                invoiceUrl: response.data.invoice_url,
                invoiceId: response.data.id,
            };
        }
        catch (error) {
            logger_1.default.error('Failed to create Xendit invoice', { userId, plan, error });
            throw error;
        }
    }
    /**
     * Get invoice status
     */
    async getInvoice(invoiceId) {
        if (!this.isActive()) {
            return null;
        }
        try {
            const response = await this.client.get(`/v2/invoices/${invoiceId}`);
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to get Xendit invoice', { invoiceId, error });
            return null;
        }
    }
    /**
     * Expire an invoice
     */
    async expireInvoice(invoiceId) {
        if (!this.isActive()) {
            return false;
        }
        try {
            await this.client.post(`/invoices/${invoiceId}/expire!`);
            logger_1.default.info('Xendit invoice expired', { invoiceId });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to expire Xendit invoice', { invoiceId, error });
            return false;
        }
    }
    /**
     * Handle Xendit webhook callback
     */
    async handleWebhook(payload, callbackToken) {
        // Verify webhook token
        const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN || '';
        if (callbackToken !== expectedToken) {
            logger_1.default.warn('Invalid Xendit webhook token');
            return { success: false, message: 'Invalid token' };
        }
        try {
            const invoice = await database_1.db.invoice.findFirst({
                where: { gatewayId: payload.id },
            });
            if (!invoice) {
                logger_1.default.warn('Invoice not found for webhook', { invoiceId: payload.id });
                return { success: false, message: 'Invoice not found' };
            }
            switch (payload.status) {
                case 'PAID':
                case 'SETTLED':
                    await this.handlePaymentSuccess(invoice.id, invoice.userId, invoice.plan, payload);
                    break;
                case 'EXPIRED':
                    await this.handlePaymentExpired(invoice.id);
                    break;
                case 'FAILED':
                    await this.handlePaymentFailed(invoice.id);
                    break;
                default:
                    logger_1.default.debug('Unhandled Xendit status', { status: payload.status });
            }
            return { success: true, message: 'Webhook processed' };
        }
        catch (error) {
            logger_1.default.error('Xendit webhook processing failed', { error });
            return { success: false, message: 'Processing failed' };
        }
    }
    /**
     * Handle successful payment
     */
    async handlePaymentSuccess(invoiceId, userId, plan, payload) {
        // Update invoice status
        await database_1.db.invoice.update({
            where: { id: invoiceId },
            data: {
                status: client_1.InvoiceStatus.PAID,
                paidAt: payload.paid_at ? new Date(payload.paid_at) : new Date(),
                gatewayData: JSON.parse(JSON.stringify(payload)),
            },
        });
        // Update user plan
        await database_1.db.user.update({
            where: { id: userId },
            data: {
                plan,
                planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        });
        logger_1.default.info('Xendit payment successful', { userId, plan, invoiceId });
    }
    /**
     * Handle expired payment
     */
    async handlePaymentExpired(invoiceId) {
        await database_1.db.invoice.update({
            where: { id: invoiceId },
            data: { status: client_1.InvoiceStatus.CANCELLED },
        });
        logger_1.default.info('Xendit invoice expired', { invoiceId });
    }
    /**
     * Handle failed payment
     */
    async handlePaymentFailed(invoiceId) {
        await database_1.db.invoice.update({
            where: { id: invoiceId },
            data: { status: client_1.InvoiceStatus.FAILED },
        });
        logger_1.default.info('Xendit payment failed', { invoiceId });
    }
    /**
     * Create recurring payment (subscription simulation)
     */
    async createRecurringPayment(userId, email, plan) {
        // Xendit doesn't have native subscriptions like Stripe
        // We handle this by creating invoices monthly via a cron job
        // This is a placeholder for the recurring payment setup
        logger_1.default.info('Recurring payment setup', { userId, plan });
        // Store subscription preference
        // The actual invoice creation will be handled by a scheduled job
    }
    /**
     * Get available payment methods for Indonesia
     */
    static getAvailablePaymentMethods() {
        return [
            // Bank Transfer
            { code: 'BCA', name: 'Bank Central Asia', type: 'bank_transfer' },
            { code: 'BNI', name: 'Bank Negara Indonesia', type: 'bank_transfer' },
            { code: 'BRI', name: 'Bank Rakyat Indonesia', type: 'bank_transfer' },
            { code: 'MANDIRI', name: 'Bank Mandiri', type: 'bank_transfer' },
            { code: 'PERMATA', name: 'Bank Permata', type: 'bank_transfer' },
            // E-Wallets
            { code: 'OVO', name: 'OVO', type: 'ewallet' },
            { code: 'DANA', name: 'DANA', type: 'ewallet' },
            { code: 'LINKAJA', name: 'LinkAja', type: 'ewallet' },
            { code: 'SHOPEEPAY', name: 'ShopeePay', type: 'ewallet' },
            // Retail
            { code: 'ALFAMART', name: 'Alfamart', type: 'retail' },
            { code: 'INDOMARET', name: 'Indomaret', type: 'retail' },
            // QR
            { code: 'QRIS', name: 'QRIS', type: 'qr' },
            // Cards
            { code: 'CREDIT_CARD', name: 'Credit/Debit Card', type: 'card' },
        ];
    }
    /**
     * Format IDR amount for display
     */
    static formatIDR(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    }
}
exports.XenditService = XenditService;
exports.default = XenditService;
//# sourceMappingURL=xendit.js.map