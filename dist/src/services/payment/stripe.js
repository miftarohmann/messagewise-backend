"use strict";
// =============================================================================
// MessageWise Optimizer - Stripe Payment Integration
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
const database_1 = require("../../config/database");
const constants_1 = require("../../config/constants");
const logger_1 = __importDefault(require("../../utils/logger"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});
// Stripe Price IDs (should be configured in environment)
const STRIPE_PRICE_IDS = {
    FREE: '',
    STARTER: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
    PRO: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
};
class StripeService {
    /**
     * Create a new customer in Stripe
     */
    async createCustomer(userId, email, name) {
        try {
            const customer = await stripe.customers.create({
                email,
                name: name || undefined,
                metadata: {
                    userId,
                },
            });
            logger_1.default.info('Stripe customer created', { customerId: customer.id, userId });
            return customer;
        }
        catch (error) {
            logger_1.default.error('Failed to create Stripe customer', { userId, error });
            throw error;
        }
    }
    /**
     * Get or create Stripe customer for user
     */
    async getOrCreateCustomer(userId, email, name) {
        // Check if user already has a Stripe customer ID
        const user = await database_1.db.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found');
        }
        // Search for existing customer
        const existingCustomers = await stripe.customers.list({
            email,
            limit: 1,
        });
        if (existingCustomers.data.length > 0) {
            return existingCustomers.data[0].id;
        }
        // Create new customer
        const customer = await this.createCustomer(userId, email, name);
        return customer.id;
    }
    /**
     * Create a checkout session for subscription
     */
    async createCheckoutSession(userId, email, plan, successUrl, cancelUrl) {
        if (plan === client_1.Plan.FREE) {
            throw new Error('Cannot create checkout session for free plan');
        }
        const priceId = STRIPE_PRICE_IDS[plan];
        if (!priceId) {
            throw new Error(`No price configured for plan: ${plan}`);
        }
        const customerId = await this.getOrCreateCustomer(userId, email);
        try {
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    userId,
                    plan,
                },
                subscription_data: {
                    metadata: {
                        userId,
                        plan,
                    },
                },
            });
            logger_1.default.info('Checkout session created', {
                sessionId: session.id,
                userId,
                plan,
            });
            return session.url || '';
        }
        catch (error) {
            logger_1.default.error('Failed to create checkout session', { userId, plan, error });
            throw error;
        }
    }
    /**
     * Create a billing portal session
     */
    async createPortalSession(email, returnUrl) {
        const customers = await stripe.customers.list({
            email,
            limit: 1,
        });
        if (customers.data.length === 0) {
            throw new Error('No Stripe customer found for this email');
        }
        const session = await stripe.billingPortal.sessions.create({
            customer: customers.data[0].id,
            return_url: returnUrl,
        });
        return session.url;
    }
    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId, immediately = false) {
        try {
            if (immediately) {
                await stripe.subscriptions.cancel(subscriptionId);
            }
            else {
                await stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true,
                });
            }
            logger_1.default.info('Subscription cancelled', { subscriptionId, immediately });
        }
        catch (error) {
            logger_1.default.error('Failed to cancel subscription', { subscriptionId, error });
            throw error;
        }
    }
    /**
     * Resume cancelled subscription
     */
    async resumeSubscription(subscriptionId) {
        try {
            await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: false,
            });
            logger_1.default.info('Subscription resumed', { subscriptionId });
        }
        catch (error) {
            logger_1.default.error('Failed to resume subscription', { subscriptionId, error });
            throw error;
        }
    }
    /**
     * Get subscription details
     */
    async getSubscription(subscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            return {
                id: subscription.id,
                plan: subscription.metadata.plan || client_1.Plan.FREE,
                status: this.mapSubscriptionStatus(subscription.status),
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get subscription', { subscriptionId, error });
            return null;
        }
    }
    /**
     * Handle Stripe webhook events
     */
    async handleWebhook(payload, signature) {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
        let event;
        try {
            event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        }
        catch (error) {
            logger_1.default.error('Webhook signature verification failed', { error });
            return { success: false, message: 'Invalid signature' };
        }
        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutComplete(event.data.object);
                    break;
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdate(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                case 'invoice.paid':
                    await this.handleInvoicePaid(event.data.object);
                    break;
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                default:
                    logger_1.default.debug('Unhandled Stripe event', { type: event.type });
            }
            return { success: true, message: 'Webhook processed' };
        }
        catch (error) {
            logger_1.default.error('Webhook processing failed', { eventType: event.type, error });
            return { success: false, message: 'Processing failed' };
        }
    }
    /**
     * Handle checkout session completed
     */
    async handleCheckoutComplete(session) {
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (!userId || !plan) {
            logger_1.default.warn('Missing metadata in checkout session', { sessionId: session.id });
            return;
        }
        // Update user plan
        await database_1.db.user.update({
            where: { id: userId },
            data: {
                plan,
                planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        });
        logger_1.default.info('User plan updated from checkout', { userId, plan });
    }
    /**
     * Handle subscription update
     */
    async handleSubscriptionUpdate(subscription) {
        const userId = subscription.metadata?.userId;
        const plan = subscription.metadata?.plan;
        if (!userId) {
            return;
        }
        const isActive = ['active', 'trialing'].includes(subscription.status);
        await database_1.db.user.update({
            where: { id: userId },
            data: {
                plan: isActive ? plan : client_1.Plan.FREE,
                planExpiresAt: new Date(subscription.current_period_end * 1000),
            },
        });
        logger_1.default.info('Subscription updated', { userId, status: subscription.status });
    }
    /**
     * Handle subscription deleted
     */
    async handleSubscriptionDeleted(subscription) {
        const userId = subscription.metadata?.userId;
        if (!userId) {
            return;
        }
        await database_1.db.user.update({
            where: { id: userId },
            data: {
                plan: client_1.Plan.FREE,
                planExpiresAt: null,
            },
        });
        logger_1.default.info('Subscription deleted, user reverted to free', { userId });
    }
    /**
     * Handle invoice paid
     */
    async handleInvoicePaid(invoice) {
        const customerId = invoice.customer;
        // Find user by customer ID
        const customers = await stripe.customers.retrieve(customerId);
        const userId = customers.metadata?.userId;
        if (!userId) {
            return;
        }
        // Create invoice record
        await database_1.db.invoice.create({
            data: {
                userId,
                invoiceNumber: invoice.number || `INV-${invoice.id}`,
                amount: (invoice.amount_paid || 0) / 100, // Convert from cents
                currency: 'USD',
                status: client_1.InvoiceStatus.PAID,
                gateway: client_1.PaymentGateway.STRIPE,
                gatewayId: invoice.id,
                gatewayData: {
                    subscription: typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null,
                    paymentIntent: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id || null,
                },
                plan: client_1.Plan.STARTER, // Will be updated based on subscription
                periodStart: new Date((invoice.period_start || 0) * 1000),
                periodEnd: new Date((invoice.period_end || 0) * 1000),
                dueDate: new Date((invoice.due_date || Date.now() / 1000) * 1000),
                paidAt: new Date(),
            },
        });
        logger_1.default.info('Invoice recorded', { userId, invoiceId: invoice.id });
    }
    /**
     * Handle payment failed
     */
    async handlePaymentFailed(invoice) {
        const customerId = invoice.customer;
        const customers = await stripe.customers.retrieve(customerId);
        const userId = customers.metadata?.userId;
        if (!userId) {
            return;
        }
        logger_1.default.warn('Payment failed', { userId, invoiceId: invoice.id });
        // Could send notification to user here
    }
    /**
     * Map Stripe subscription status
     */
    mapSubscriptionStatus(status) {
        switch (status) {
            case 'active':
            case 'trialing':
                return 'active';
            case 'canceled':
                return 'cancelled';
            case 'past_due':
            case 'unpaid':
                return 'expired';
            default:
                return 'pending';
        }
    }
    /**
     * Get plan price
     */
    static getPlanPrice(plan) {
        const pricing = constants_1.PRICING[plan];
        return {
            usd: pricing.price,
            idr: pricing.priceIDR,
        };
    }
}
exports.StripeService = StripeService;
exports.default = StripeService;
//# sourceMappingURL=stripe.js.map