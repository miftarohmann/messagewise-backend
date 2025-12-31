import { AlertData, DailySummaryData } from '../../types';
export declare class TelegramNotifier {
    private bot;
    private isEnabled;
    constructor();
    /**
     * Check if Telegram notifications are enabled
     */
    isActive(): boolean;
    /**
     * Send cost alert to user
     */
    sendCostAlert(telegramId: string, data: AlertData): Promise<boolean>;
    /**
     * Send daily summary to user
     */
    sendDailySummary(telegramId: string, data: DailySummaryData): Promise<boolean>;
    /**
     * Send savings report
     */
    sendSavingsReport(telegramId: string, data: {
        accountName: string;
        periodStart: Date;
        periodEnd: Date;
        actualSavings: number;
        optimizationScore: number;
        totalCost: number;
        potentialSavings: number;
    }): Promise<boolean>;
    /**
     * Send budget warning
     */
    sendBudgetWarning(telegramId: string, data: {
        accountName: string;
        currentSpend: number;
        budget: number;
        percentageUsed: number;
        daysRemaining: number;
    }): Promise<boolean>;
    /**
     * Send recommendation notification
     */
    sendRecommendation(telegramId: string, data: {
        accountName: string;
        title: string;
        description: string;
        potentialSavings: number;
        priority: string;
    }): Promise<boolean>;
    /**
     * Send welcome message when user connects Telegram
     */
    sendWelcome(telegramId: string, userName: string): Promise<boolean>;
    /**
     * Send account connected notification
     */
    sendAccountConnected(telegramId: string, accountName: string, phoneNumber: string): Promise<boolean>;
    /**
     * Core message sending method
     */
    private sendMessage;
    /**
     * Handle blocked user
     */
    private handleBlockedUser;
    /**
     * Escape Markdown special characters
     */
    private escapeMarkdown;
    /**
     * Format date for display
     */
    private formatDate;
    /**
     * Generate Telegram link code for account connection
     */
    static generateLinkCode(userId: string): string;
    /**
     * Verify link code
     */
    static verifyLinkCode(code: string, maxAgeMs?: number): {
        userId: string;
        valid: boolean;
    };
}
export default TelegramNotifier;
//# sourceMappingURL=notifier.d.ts.map