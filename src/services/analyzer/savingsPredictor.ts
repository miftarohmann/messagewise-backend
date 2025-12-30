// =============================================================================
// MessageWise Optimizer - Savings Predictor Service
// =============================================================================

import { MessageCategory } from '@prisma/client';
import { WA_PRICING } from '../../config/constants';
import { round, percentageChange, average } from '../../utils/helpers';
import logger from '../../utils/logger';

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

export class SavingsPredictor {
  private country: string;

  constructor(country: string = 'ID') {
    this.country = country;
  }

  /**
   * Predict future costs and savings based on historical data
   */
  predictFuture(historicalData: HistoricalData[], daysToPredict: number = 30): PredictionResult {
    const startTime = Date.now();

    try {
      if (historicalData.length < 3) {
        return this.getDefaultPrediction(historicalData);
      }

      // Sort by date
      const sortedData = [...historicalData].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      // Calculate trends
      const costTrend = this.calculateTrend(sortedData.map((d) => d.totalCost));
      const messageTrend = this.calculateTrend(sortedData.map((d) => d.totalMessages));
      const savingsTrend = this.calculateTrend(sortedData.map((d) => d.actualSavings));

      // Calculate averages for base prediction
      const avgDailyCost = average(sortedData.map((d) => d.totalCost));
      const avgDailyMessages = average(sortedData.map((d) => d.totalMessages));
      const avgDailySavings = average(sortedData.map((d) => d.actualSavings));

      // Apply trend to predictions
      const predictedMonthlyCost = this.applyTrendToPrediction(
        avgDailyCost * 30,
        costTrend,
        daysToPredict
      );
      const predictedMonthlyMessages = Math.round(
        this.applyTrendToPrediction(avgDailyMessages * 30, messageTrend, daysToPredict)
      );
      const predictedSavings = this.applyTrendToPrediction(
        avgDailySavings * 30,
        savingsTrend,
        daysToPredict
      );

      // Calculate confidence based on data consistency
      const confidenceScore = this.calculateConfidence(sortedData);

      // Generate recommendations
      const recommendations = this.generatePredictiveRecommendations(sortedData, costTrend);

      const duration = Date.now() - startTime;
      logger.debug('Savings prediction completed', {
        dataPoints: historicalData.length,
        predictedCost: predictedMonthlyCost,
        confidence: confidenceScore,
        duration: `${duration}ms`,
      });

      return {
        predictedMonthlyCost: round(predictedMonthlyCost, 2),
        predictedMonthlyMessages,
        predictedSavings: round(Math.max(predictedSavings, 0), 2),
        confidenceScore: round(confidenceScore, 2),
        trend: this.categorizeTrend(costTrend),
        recommendations,
      };
    } catch (error) {
      logger.error('Error predicting savings', { error });
      return this.getDefaultPrediction(historicalData);
    }
  }

  /**
   * Track actual savings vs predicted savings
   */
  trackSavings(
    periodData: HistoricalData[],
    implementedRecommendations: string[]
  ): SavingsTracking {
    if (periodData.length === 0) {
      return {
        periodStart: new Date(),
        periodEnd: new Date(),
        potentialSavings: 0,
        actualSavings: 0,
        implementedRecommendations,
        savingsRate: 0,
      };
    }

    const sortedData = [...periodData].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const periodStart = sortedData[0].date;
    const periodEnd = sortedData[sortedData.length - 1].date;

    // Calculate potential savings (what could have been saved with all optimizations)
    const potentialSavings = this.calculatePotentialSavings(periodData);

    // Calculate actual savings achieved
    const actualSavings = periodData.reduce((sum, d) => sum + d.actualSavings, 0);

    // Calculate savings rate
    const savingsRate = potentialSavings > 0 ? actualSavings / potentialSavings : 0;

    return {
      periodStart,
      periodEnd,
      potentialSavings: round(potentialSavings, 2),
      actualSavings: round(actualSavings, 2),
      implementedRecommendations,
      savingsRate: round(savingsRate, 4),
    };
  }

  /**
   * Estimate savings from implementing specific recommendations
   */
  estimateRecommendationImpact(
    recommendation: string,
    currentData: HistoricalData[]
  ): {
    estimatedSavings: number;
    timeToImpact: string;
    confidence: number;
  } {
    const totalCost = currentData.reduce((sum, d) => sum + d.totalCost, 0);
    const totalMessages = currentData.reduce((sum, d) => sum + d.totalMessages, 0);

    // Map recommendation types to impact estimates
    const impactMap: Record<
      string,
      { savingsRate: number; timeToImpact: string; confidence: number }
    > = {
      timing: { savingsRate: 0.2, timeToImpact: '1-2 weeks', confidence: 0.8 },
      classification: { savingsRate: 0.15, timeToImpact: '2-4 weeks', confidence: 0.7 },
      conversation: { savingsRate: 0.1, timeToImpact: '1-2 weeks', confidence: 0.75 },
      volume: { savingsRate: 0.1, timeToImpact: '1-3 months', confidence: 0.6 },
      template: { savingsRate: 0.08, timeToImpact: '2-4 weeks', confidence: 0.65 },
    };

    const recommendationType = this.categorizeRecommendation(recommendation);
    const impact = impactMap[recommendationType] || {
      savingsRate: 0.05,
      timeToImpact: 'Varies',
      confidence: 0.5,
    };

    return {
      estimatedSavings: round(totalCost * impact.savingsRate, 2),
      timeToImpact: impact.timeToImpact,
      confidence: impact.confidence,
    };
  }

  /**
   * Calculate ROI if user upgrades to a paid plan
   */
  calculatePlanROI(
    historicalData: HistoricalData[],
    currentPlan: string,
    targetPlan: string
  ): {
    currentMonthlyCost: number;
    projectedSavings: number;
    planCost: number;
    netBenefit: number;
    breakEvenDays: number;
    recommended: boolean;
  } {
    const planPrices: Record<string, number> = {
      FREE: 0,
      STARTER: 15,
      PRO: 49,
      ENTERPRISE: 199,
    };

    const savingsMultiplier: Record<string, number> = {
      FREE: 1.0,
      STARTER: 1.15, // 15% better optimization with features
      PRO: 1.25, // 25% better with CRM integrations
      ENTERPRISE: 1.4, // 40% better with full features
    };

    const avgMonthlyCost = average(historicalData.map((d) => d.totalCost)) * 30;
    const currentSavings =
      average(historicalData.map((d) => d.actualSavings)) *
      30 *
      (savingsMultiplier[currentPlan] || 1);

    const projectedSavings =
      avgMonthlyCost * 0.3 * (savingsMultiplier[targetPlan] || 1); // Base 30% savings potential

    const planCost = planPrices[targetPlan] || 0;
    const netBenefit = projectedSavings - planCost;

    // Break-even calculation
    const additionalSavings = projectedSavings - currentSavings;
    const breakEvenDays =
      additionalSavings > 0 ? Math.ceil((planCost / additionalSavings) * 30) : 999;

    return {
      currentMonthlyCost: round(avgMonthlyCost, 2),
      projectedSavings: round(projectedSavings, 2),
      planCost,
      netBenefit: round(netBenefit, 2),
      breakEvenDays,
      recommended: netBenefit > planCost * 0.5, // Recommend if benefit > 50% of plan cost
    };
  }

  /**
   * Generate savings forecast for next N months
   */
  generateForecast(
    historicalData: HistoricalData[],
    months: number = 6
  ): Array<{
    month: string;
    predictedCost: number;
    predictedSavings: number;
    cumulativeSavings: number;
  }> {
    const forecast: Array<{
      month: string;
      predictedCost: number;
      predictedSavings: number;
      cumulativeSavings: number;
    }> = [];

    const basePrediction = this.predictFuture(historicalData, 30);
    let cumulativeSavings = 0;

    // Account for improvement over time
    const improvementRate = 0.05; // 5% improvement per month as optimizations are implemented

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i + 1);
      const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });

      const improvementMultiplier = 1 + improvementRate * i;
      const predictedCost = basePrediction.predictedMonthlyCost * (1 - improvementRate * i);
      const predictedSavings = basePrediction.predictedSavings * improvementMultiplier;

      cumulativeSavings += predictedSavings;

      forecast.push({
        month: monthName,
        predictedCost: round(Math.max(predictedCost, 0), 2),
        predictedSavings: round(predictedSavings, 2),
        cumulativeSavings: round(cumulativeSavings, 2),
      });
    }

    return forecast;
  }

  /**
   * Calculate trend from array of values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Simple linear regression slope
    const n = values.length;
    const xSum = (n * (n - 1)) / 2; // Sum of 0 to n-1
    const ySum = values.reduce((a, b) => a + b, 0);
    const xySum = values.reduce((sum, y, x) => sum + x * y, 0);
    const xxSum = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares 0 to n-1

    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);

    return slope;
  }

  /**
   * Apply trend to base prediction
   */
  private applyTrendToPrediction(
    baseValue: number,
    trend: number,
    days: number
  ): number {
    // Dampen trend for predictions (don't extrapolate linearly)
    const dampenedTrend = trend * 0.5;
    return baseValue + dampenedTrend * days;
  }

  /**
   * Categorize trend as increasing, decreasing, or stable
   */
  private categorizeTrend(trend: number): 'increasing' | 'decreasing' | 'stable' {
    if (trend > 0.1) return 'increasing';
    if (trend < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate confidence score based on data consistency
   */
  private calculateConfidence(data: HistoricalData[]): number {
    if (data.length < 5) return 0.5;

    // Calculate coefficient of variation
    const costs = data.map((d) => d.totalCost);
    const mean = average(costs);
    const variance =
      costs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / costs.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? stdDev / mean : 1;

    // Lower CV = more consistent = higher confidence
    const confidence = Math.max(0.3, Math.min(0.95, 1 - cv));

    // Boost confidence with more data points
    const dataBonus = Math.min(data.length * 0.01, 0.1);

    return confidence + dataBonus;
  }

  /**
   * Generate predictive recommendations based on trends
   */
  private generatePredictiveRecommendations(
    data: HistoricalData[],
    costTrend: number
  ): string[] {
    const recommendations: string[] = [];

    if (costTrend > 0.5) {
      recommendations.push('Your costs are trending upward. Review message templates for reclassification opportunities.');
    }

    // Check category distribution trends
    const latestData = data[data.length - 1];
    if (latestData) {
      const marketingCount =
        latestData.breakdown.find((b) => b.category === MessageCategory.MARKETING)?.count || 0;
      const totalCount = latestData.totalMessages;

      if (marketingCount / totalCount > 0.5) {
        recommendations.push('High marketing message ratio. Consider converting some to utility messages.');
      }
    }

    // Check free window utilization
    const avgFreeRatio =
      average(data.map((d) => d.freeMessages / Math.max(d.totalMessages, 1))) || 0;
    if (avgFreeRatio < 0.3) {
      recommendations.push('Low free window utilization. Time your outbound messages within 24h of customer contact.');
    }

    return recommendations;
  }

  /**
   * Calculate potential savings from historical data
   */
  private calculatePotentialSavings(data: HistoricalData[]): number {
    let potential = 0;

    for (const day of data) {
      // Potential from timing optimization (marketing messages)
      const marketingData = day.breakdown.find(
        (b) => b.category === MessageCategory.MARKETING
      );
      if (marketingData) {
        potential += marketingData.cost * 0.3; // Assume 30% could be free with timing
      }

      // Potential from reclassification
      if (marketingData && marketingData.count > 0) {
        const marketingRate = this.getRate(MessageCategory.MARKETING);
        const utilityRate = this.getRate(MessageCategory.UTILITY);
        potential += marketingData.count * 0.2 * (marketingRate - utilityRate);
      }
    }

    return potential;
  }

  /**
   * Get rate for a category
   */
  private getRate(category: MessageCategory): number {
    const rates = WA_PRICING.COUNTRY_RATES[this.country as keyof typeof WA_PRICING.COUNTRY_RATES]
      || WA_PRICING.CATEGORIES;

    return rates[category as keyof typeof rates] || 0;
  }

  /**
   * Categorize recommendation type
   */
  private categorizeRecommendation(recommendation: string): string {
    const lower = recommendation.toLowerCase();

    if (lower.includes('timing') || lower.includes('24h') || lower.includes('window')) {
      return 'timing';
    }
    if (lower.includes('reclassif') || lower.includes('category')) {
      return 'classification';
    }
    if (lower.includes('conversation') || lower.includes('follow-up')) {
      return 'conversation';
    }
    if (lower.includes('volume') || lower.includes('discount')) {
      return 'volume';
    }
    if (lower.includes('template')) {
      return 'template';
    }

    return 'general';
  }

  /**
   * Get default prediction when insufficient data
   */
  private getDefaultPrediction(historicalData: HistoricalData[]): PredictionResult {
    const avgCost = historicalData.length > 0
      ? average(historicalData.map((d) => d.totalCost))
      : 0;
    const avgMessages = historicalData.length > 0
      ? average(historicalData.map((d) => d.totalMessages))
      : 0;

    return {
      predictedMonthlyCost: round(avgCost * 30, 2),
      predictedMonthlyMessages: Math.round(avgMessages * 30),
      predictedSavings: round(avgCost * 30 * 0.2, 2), // Conservative 20% estimate
      confidenceScore: 0.3,
      trend: 'stable',
      recommendations: ['Add more historical data for accurate predictions'],
    };
  }
}

export default SavingsPredictor;
