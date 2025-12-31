import { MessageCategory, Currency } from '@prisma/client';
import { CostBreakdown, TrendData } from '../../types';
interface MessageForCost {
    category: MessageCategory;
    isInFreeWindow: boolean;
    direction: 'INBOUND' | 'OUTBOUND';
    timestamp: Date;
    conversationId?: string;
}
interface VolumeDiscount {
    tier: string;
    discount: number;
    threshold: number;
}
interface CostCalculationOptions {
    country?: string;
    currency?: Currency;
    applyVolumeDiscounts?: boolean;
    includeFreeTier?: boolean;
}
export declare class CostCalculator {
    private country;
    private currency;
    constructor(country?: string, currency?: Currency);
    /**
     * Calculate total cost for a set of messages
     */
    calculateCost(messages: MessageForCost[], options?: CostCalculationOptions): CostBreakdown;
    /**
     * Calculate cost with volume discounts explicitly shown
     */
    calculateWithDiscountBreakdown(messages: MessageForCost[], options?: CostCalculationOptions): CostBreakdown & {
        discountApplied: VolumeDiscount;
        originalCost: number;
    };
    /**
     * Calculate daily costs for a period
     */
    calculateDailyCosts(messages: MessageForCost[]): Map<string, CostBreakdown>;
    /**
     * Calculate potential savings if optimizations are applied
     */
    calculatePotentialSavings(messages: MessageForCost[]): {
        totalPotentialSavings: number;
        breakdown: {
            category: string;
            description: string;
            savings: number;
        }[];
    };
    /**
     * Compare costs between two periods
     */
    comparePeriods(currentMessages: MessageForCost[], previousMessages: MessageForCost[]): {
        current: CostBreakdown;
        previous: CostBreakdown;
        costTrend: TrendData;
        messageTrend: TrendData;
    };
    /**
     * Get cost per message for a category
     */
    getMessageCost(category: MessageCategory, country?: string): number;
    /**
     * Check if a message is free
     */
    private isMessageFree;
    /**
     * Get volume discount based on conversation count
     */
    private getVolumeDiscount;
    /**
     * Get next volume tier for upgrade opportunity
     */
    private getNextVolumeTier;
    /**
     * Build category breakdown array
     */
    private buildCategoryBreakdown;
    /**
     * Estimate monthly cost based on current usage
     */
    estimateMonthlyCost(dailyMessages: MessageForCost[], daysInSample: number): {
        estimatedMonthlyCost: number;
        estimatedMonthlyMessages: number;
        projectedSavings: number;
    };
}
export default CostCalculator;
//# sourceMappingURL=costCalculator.d.ts.map