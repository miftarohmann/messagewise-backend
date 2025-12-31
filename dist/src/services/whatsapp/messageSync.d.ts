interface SyncResult {
    success: boolean;
    messagesProcessed: number;
    analysisGenerated: boolean;
    errors: string[];
}
export declare class MessageSyncService {
    private classifier;
    private calculator;
    private optimizer;
    constructor();
    /**
     * Sync messages for an account
     */
    syncAccount(accountId: string): Promise<SyncResult>;
    /**
     * Generate daily cost analysis
     */
    generateDailyAnalysis(accountId: string, date?: Date): Promise<boolean>;
    /**
     * Generate monthly analysis
     */
    generateMonthlyAnalysis(accountId: string, year: number, month: number): Promise<boolean>;
    /**
     * Sync all active accounts
     */
    syncAllAccounts(): Promise<{
        success: number;
        failed: number;
    }>;
    /**
     * Recalculate costs for historical messages
     */
    recalculateCosts(accountId: string, startDate: Date, endDate: Date): Promise<{
        updated: number;
    }>;
}
export default MessageSyncService;
//# sourceMappingURL=messageSync.d.ts.map