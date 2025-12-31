import { MessageCategory } from '@prisma/client';
import { Recommendation } from '../../types';
interface MessageForOptimization {
    id: string;
    category: MessageCategory;
    isInFreeWindow: boolean;
    direction: 'INBOUND' | 'OUTBOUND';
    timestamp: Date;
    conversationId?: string;
    content?: string;
    cost: number;
}
interface OptimizationAnalysis {
    totalCost: number;
    totalMessages: number;
    freeMessages: number;
    paidMessages: number;
    breakdown: {
        category: MessageCategory;
        count: number;
        cost: number;
    }[];
}
export declare class CostOptimizer {
    private country;
    constructor(country?: string);
    /**
     * Generate optimization recommendations based on message patterns
     */
    generateRecommendations(messages: MessageForOptimization[], analysis: OptimizationAnalysis): Recommendation[];
    /**
     * Analyze marketing message timing
     */
    private analyzeMarketingTiming;
    /**
     * Analyze reclassification opportunities
     */
    private analyzeReclassificationOpportunity;
    /**
     * Analyze conversation window utilization
     */
    private analyzeConversationUtilization;
    /**
     * Analyze volume discount opportunity
     */
    private analyzeVolumeDiscount;
    /**
     * Analyze template usage patterns
     */
    private analyzeTemplateUsage;
    /**
     * Analyze peak time patterns
     */
    private analyzePeakTimePatterns;
    /**
     * Analyze conversation metrics
     */
    private analyzeConversations;
    /**
     * Get rate for a category
     */
    private getRate;
    /**
     * Calculate optimization score (0-100)
     */
    calculateOptimizationScore(messages: MessageForOptimization[], analysis: OptimizationAnalysis): number;
}
export default CostOptimizer;
//# sourceMappingURL=optimizer.d.ts.map