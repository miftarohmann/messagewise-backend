interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
declare class EmailService {
    private transporter;
    private isEnabled;
    constructor();
    private initialize;
    sendEmail(options: EmailOptions): Promise<boolean>;
    /**
     * Welcome email for new users
     */
    sendWelcomeEmail(to: string, name: string): Promise<boolean>;
    /**
     * Password reset email
     */
    sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean>;
    /**
     * Daily summary email
     */
    sendDailySummaryEmail(to: string, name: string, data: {
        totalMessages: number;
        totalCost: number;
        costBreakdown: {
            category: string;
            cost: number;
        }[];
        savingsOpportunity: number;
    }): Promise<boolean>;
    /**
     * Cost alert email
     */
    sendCostAlertEmail(to: string, name: string, data: {
        currentCost: number;
        threshold: number;
        percentageOver: number;
    }): Promise<boolean>;
    /**
     * Payment confirmation email
     */
    sendPaymentConfirmationEmail(to: string, name: string, data: {
        plan: string;
        amount: number;
        currency: string;
        invoiceNumber: string;
        periodEnd: Date;
    }): Promise<boolean>;
    /**
     * Subscription expiring email
     */
    sendSubscriptionExpiringEmail(to: string, name: string, data: {
        plan: string;
        expiresAt: Date;
        daysRemaining: number;
    }): Promise<boolean>;
    private getBaseStyles;
    private wrapInLayout;
    private getWelcomeTemplate;
    private getPasswordResetTemplate;
    private getDailySummaryTemplate;
    private getCostAlertTemplate;
    private getPaymentConfirmationTemplate;
    private getSubscriptionExpiringTemplate;
}
export declare const emailService: EmailService;
export default emailService;
//# sourceMappingURL=mailer.d.ts.map