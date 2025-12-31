import { Plan } from '@prisma/client';
interface XenditInvoice {
    id: string;
    external_id: string;
    user_id: string;
    status: string;
    amount: number;
    payer_email: string;
    description: string;
    invoice_url: string;
    expiry_date: string;
    created: string;
    updated: string;
    paid_at?: string;
    paid_amount?: number;
    payment_method?: string;
    payment_channel?: string;
}
export declare class XenditService {
    private client;
    private isEnabled;
    constructor();
    /**
     * Check if Xendit is enabled
     */
    isActive(): boolean;
    /**
     * Create an invoice for subscription
     */
    createInvoice(userId: string, email: string, plan: Plan, successUrl: string, failureUrl: string): Promise<{
        invoiceUrl: string;
        invoiceId: string;
    }>;
    /**
     * Get invoice status
     */
    getInvoice(invoiceId: string): Promise<XenditInvoice | null>;
    /**
     * Expire an invoice
     */
    expireInvoice(invoiceId: string): Promise<boolean>;
    /**
     * Handle Xendit webhook callback
     */
    handleWebhook(payload: XenditInvoice, callbackToken: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handle successful payment
     */
    private handlePaymentSuccess;
    /**
     * Handle expired payment
     */
    private handlePaymentExpired;
    /**
     * Handle failed payment
     */
    private handlePaymentFailed;
    /**
     * Create recurring payment (subscription simulation)
     */
    createRecurringPayment(userId: string, email: string, plan: Plan): Promise<void>;
    /**
     * Get available payment methods for Indonesia
     */
    static getAvailablePaymentMethods(): Array<{
        code: string;
        name: string;
        type: string;
    }>;
    /**
     * Format IDR amount for display
     */
    static formatIDR(amount: number): string;
}
export default XenditService;
//# sourceMappingURL=xendit.d.ts.map