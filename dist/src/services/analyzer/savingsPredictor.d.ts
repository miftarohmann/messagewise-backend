import { MessageCategory } from '@prisma/client';
interface HistoricalData {
    date: Date;
    totalCost: number;
    totalMessages: number;
    freeMessages: number;
    paidMessages: number;
    breakdown: {
        category: MessageCategory;
        count: number;
        cost: number;
    }[];
    actualSavings: number;
}
interface PredictionResult {
    predictedMonthlyCost: number;
    predictedMonthlyMessages: number;
    predictedSavings: number;
    confidenceScore: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    recommendations: string[];
}
interface SavingsTracking {
    periodStart: Date;
    periodEnd: Date;
    potentialSavings: number;
    actualSavings: number;
    implementedRecommendations: string[];
    savingsRate: number;
}
export declare class SavingsPredictor {
    private country;
    constructor(country?: string);
    /**
     * Predict future costs and savings based on historical data
     */
    predictFuture(historicalData: HistoricalData[], daysToPredict?: number): PredictionResult;
    /**
     * Track actual savings vs predicted savings
     */
    trackSavings(periodData: HistoricalData[], implementedRecommendations: string[]): SavingsTracking;
    /**
     * Estimate savings from implementing specific recommendations
     */
    estimateRecommendationImpact(recommendation: string, currentData: HistoricalData[]): {
        estimatedSavings: number;
        timeToImpact: string;
        confidence: number;
    };
    /**
     * Calculate ROI if user upgrades to a paid plan
     */
    calculatePlanROI(historicalData: HistoricalData[], currentPlan: string, targetPlan: string): {
        currentMonthlyCost: number;
        projectedSavings: number;
        planCost: number;
        netBenefit: number;
        breakEvenDays: number;
        recommended: boolean;
    };
    /**
     * Generate savings forecast for next N months
     */
    generateForecast(historicalData: HistoricalData[], months?: number): Array<{
        month: string;
        predictedCost: number;
        predictedSavings: number;
        cumulativeSavings: number;
    }>;
    /**
     * Calculate trend from array of values
     */
    private calculateTrend;
    /**
     * Apply trend to base prediction
     */
    private applyTrendToPrediction;
    /**
     * Categorize trend as increasing, decreasing, or stable
     */
    private categorizeTrend;
    /**
     * Calculate confidence score based on data consistency
     */
    private calculateConfidence;
    /**
     * Generate predictive recommendations based on trends
     */
    private generatePredictiveRecommendations;
    /**
     * Calculate potential savings from historical data
     */
    private calculatePotentialSavings;
    /**
     * Get rate for a category
     */
    private getRate;
    /**
     * Categorize recommendation type
     */
    private categorizeRecommendation;
    /**
     * Get default prediction when insufficient data
     */
    private getDefaultPrediction;
}
export default SavingsPredictor;
//# sourceMappingURL=savingsPredictor.d.ts.map