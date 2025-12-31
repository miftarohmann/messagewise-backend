import Stripe from 'stripe';
import { Plan } from '@prisma/client';
import { SubscriptionResponse } from '../../types';
export declare class StripeService {
    /**
     * Create a new customer in Stripe
     */
    createCustomer(userId: string, email: string, name?: string): Promise<Stripe.Customer>;
    /**
     * Get or create Stripe customer for user
     */
    getOrCreateCustomer(userId: string, email: string, name?: string): Promise<string>;
    /**
     * Create a checkout session for subscription
     */
    createCheckoutSession(userId: string, email: string, plan: Plan, successUrl: string, cancelUrl: string): Promise<string>;
    /**
     * Create a billing portal session
     */
    createPortalSession(email: string, returnUrl: string): Promise<string>;
    /**
     * Cancel subscription
     */
    cancelSubscription(subscriptionId: string, immediately?: boolean): Promise<void>;
    /**
     * Resume cancelled subscription
     */
    resumeSubscription(subscriptionId: string): Promise<void>;
    /**
     * Get subscription details
     */
    getSubscription(subscriptionId: string): Promise<SubscriptionResponse | null>;
    /**
     * Handle Stripe webhook events
     */
    handleWebhook(payload: string, signature: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handle checkout session completed
     */
    private handleCheckoutComplete;
    /**
     * Handle subscription update
     */
    private handleSubscriptionUpdate;
    /**
     * Handle subscription deleted
     */
    private handleSubscriptionDeleted;
    /**
     * Handle invoice paid
     */
    private handleInvoicePaid;
    /**
     * Handle payment failed
     */
    private handlePaymentFailed;
    /**
     * Map Stripe subscription status
     */
    private mapSubscriptionStatus;
    /**
     * Get plan price
     */
    static getPlanPrice(plan: Plan): {
        usd: number;
        idr: number;
    };
}
export default StripeService;
//# sourceMappingURL=stripe.d.ts.map