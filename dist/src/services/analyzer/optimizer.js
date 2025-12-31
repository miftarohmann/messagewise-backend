"use strict";
// =============================================================================
// MessageWise Optimizer - Optimization Recommendations Service
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostOptimizer = void 0;
const client_1 = require("@prisma/client");
const constants_1 = require("../../config/constants");
const helpers_1 = require("../../utils/helpers");
const logger_1 = __importDefault(require("../../utils/logger"));
class CostOptimizer {
    country;
    constructor(country = 'ID') {
        this.country = country;
    }
    /**
     * Generate optimization recommendations based on message patterns
     */
    generateRecommendations(messages, analysis) {
        const startTime = Date.now();
        const recommendations = [];
        try {
            // Skip if no messages or very low cost
            if (messages.length === 0 || analysis.totalCost < 0.01) {
                return [];
            }
            // Get conversation metrics
            const conversationMetrics = this.analyzeConversations(messages);
            // 1. Marketing messages timing optimization
            const timingRec = this.analyzeMarketingTiming(messages, analysis);
            if (timingRec) {
                recommendations.push(timingRec);
            }
            // 2. Message reclassification opportunity
            const reclassifyRec = this.analyzeReclassificationOpportunity(messages, analysis);
            if (reclassifyRec) {
                recommendations.push(reclassifyRec);
            }
            // 3. Conversation utilization
            const conversationRec = this.analyzeConversationUtilization(messages, conversationMetrics, analysis);
            if (conversationRec) {
                recommendations.push(conversationRec);
            }
            // 4. Volume discount opportunity
            const volumeRec = this.analyzeVolumeDiscount(messages, analysis);
            if (volumeRec) {
                recommendations.push(volumeRec);
            }
            // 5. Template optimization
            const templateRec = this.analyzeTemplateUsage(messages, analysis);
            if (templateRec) {
                recommendations.push(templateRec);
            }
            // 6. Peak time optimization
            const peakTimeRec = this.analyzePeakTimePatterns(messages, analysis);
            if (peakTimeRec) {
                recommendations.push(peakTimeRec);
            }
            // Sort by potential savings (highest first)
            recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
            // Assign IDs
            recommendations.forEach((rec, index) => {
                rec.id = `rec_${index + 1}_${Date.now()}`;
            });
            const duration = Date.now() - startTime;
            logger_1.default.debug('Optimization analysis completed', {
                recommendationCount: recommendations.length,
                totalPotentialSavings: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0),
                duration: `${duration}ms`,
            });
            return recommendations;
        }
        catch (error) {
            logger_1.default.error('Error generating recommendations', { error });
            return [];
        }
    }
    /**
     * Analyze marketing message timing
     */
    analyzeMarketingTiming(messages, analysis) {
        const marketingOutsideWindow = messages.filter((m) => m.category === client_1.MessageCategory.MARKETING &&
            !m.isInFreeWindow &&
            m.direction === 'OUTBOUND');
        if (marketingOutsideWindow.length === 0) {
            return null;
        }
        const marketingRate = this.getRate(client_1.MessageCategory.MARKETING);
        const potentialSavings = marketingOutsideWindow.length * marketingRate;
        const savingsPercentage = (0, helpers_1.percentage)(potentialSavings, analysis.totalCost);
        if (potentialSavings < 0.01) {
            return null;
        }
        return {
            id: '',
            title: 'Send Marketing Messages Within 24h Window',
            description: `You sent ${marketingOutsideWindow.length} marketing messages outside the free 24-hour service window. These could be sent as responses to customer inquiries instead for free.`,
            potentialSavings: (0, helpers_1.round)(potentialSavings, 2),
            savingsPercentage: (0, helpers_1.round)(savingsPercentage, 1),
            priority: savingsPercentage > 20 ? 'high' : savingsPercentage > 10 ? 'medium' : 'low',
            actionable: true,
            steps: [
                'Trigger marketing messages as responses to customer inquiries within 24 hours',
                'Use chatbots to initiate conversations naturally and then follow up with promotions',
                'Schedule marketing campaigns based on customer interaction patterns',
                'Create engagement triggers that prompt customers to message first',
            ],
            category: 'timing',
            implemented: false,
        };
    }
    /**
     * Analyze reclassification opportunities
     */
    analyzeReclassificationOpportunity(messages, analysis) {
        // Find marketing messages that could potentially be utility
        const marketingMessages = messages.filter((m) => m.category === client_1.MessageCategory.MARKETING &&
            !m.isInFreeWindow &&
            m.direction === 'OUTBOUND');
        // Analyze content for transactional keywords
        const potentialUtility = marketingMessages.filter((m) => {
            if (!m.content)
                return false;
            const content = m.content.toLowerCase();
            const transactionalKeywords = [
                'order', 'pesanan', 'invoice', 'payment', 'pembayaran',
                'confirmation', 'konfirmasi', 'receipt', 'tracking', 'lacak',
            ];
            return transactionalKeywords.some((k) => content.includes(k));
        });
        // Estimate 30% could be reclassified based on content patterns
        const estimatedReclassifiable = Math.round(marketingMessages.length * 0.3);
        if (estimatedReclassifiable === 0) {
            return null;
        }
        const marketingRate = this.getRate(client_1.MessageCategory.MARKETING);
        const utilityRate = this.getRate(client_1.MessageCategory.UTILITY);
        const savingsPerMessage = marketingRate - utilityRate;
        const potentialSavings = estimatedReclassifiable * savingsPerMessage;
        const savingsPercentage = (0, helpers_1.percentage)(potentialSavings, analysis.totalCost);
        if (potentialSavings < 0.01) {
            return null;
        }
        return {
            id: '',
            title: 'Reclassify Messages as Utility',
            description: `Approximately ${estimatedReclassifiable} messages could be reclassified as utility (transactional) messages, which cost ${(0, helpers_1.round)((1 - utilityRate / marketingRate) * 100)}% less than marketing messages.`,
            potentialSavings: (0, helpers_1.round)(potentialSavings, 2),
            savingsPercentage: (0, helpers_1.round)(savingsPercentage, 1),
            priority: savingsPercentage > 15 ? 'high' : savingsPercentage > 5 ? 'medium' : 'low',
            actionable: true,
            steps: [
                'Review message templates and remove promotional language from transactional messages',
                'Separate order confirmations, receipts, and tracking updates from marketing content',
                'Use dedicated utility templates for transactional communications',
                'Ensure utility messages focus on customer service, not promotion',
            ],
            category: 'classification',
            implemented: false,
        };
    }
    /**
     * Analyze conversation window utilization
     */
    analyzeConversationUtilization(messages, metrics, analysis) {
        // Low utilization if less than 3 messages per conversation on average
        if (metrics.avgMessagesPerConversation >= 3 || metrics.freeWindowUtilization > 0.7) {
            return null;
        }
        // Estimate savings from better window utilization
        const potentialSavings = analysis.totalCost * 0.15; // Conservative estimate
        const savingsPercentage = 15;
        if (potentialSavings < 0.01) {
            return null;
        }
        return {
            id: '',
            title: 'Maximize 24-Hour Conversation Windows',
            description: `You're averaging only ${(0, helpers_1.round)(metrics.avgMessagesPerConversation, 1)} messages per conversation. The 24-hour free service window allows unlimited follow-up messages at no cost.`,
            potentialSavings: (0, helpers_1.round)(potentialSavings, 2),
            savingsPercentage: (0, helpers_1.round)(savingsPercentage, 1),
            priority: 'medium',
            actionable: true,
            steps: [
                'Set up automated follow-up sequences within 24 hours of customer contact',
                'Bundle multiple related messages within a single conversation window',
                'Use chatbots to maintain engagement and extend conversations naturally',
                'Create touchpoint reminders to reach out before the window closes',
            ],
            category: 'conversation',
            implemented: false,
        };
    }
    /**
     * Analyze volume discount opportunity
     */
    analyzeVolumeDiscount(messages, analysis) {
        const uniqueConversations = new Set(messages.map((m) => m.conversationId).filter(Boolean)).size;
        const tiers = constants_1.WA_PRICING.VOLUME_DISCOUNTS;
        // Find current tier and next tier
        let currentDiscount = 0;
        let nextThreshold = 0;
        let nextDiscount = 0;
        if (uniqueConversations <= tiers.TIER_1.max) {
            currentDiscount = 0;
            nextThreshold = tiers.TIER_2.min;
            nextDiscount = tiers.TIER_2.discount;
        }
        else if (uniqueConversations <= tiers.TIER_2.max) {
            currentDiscount = tiers.TIER_2.discount;
            nextThreshold = tiers.TIER_3.min;
            nextDiscount = tiers.TIER_3.discount;
        }
        else if (uniqueConversations <= tiers.TIER_3.max) {
            currentDiscount = tiers.TIER_3.discount;
            nextThreshold = tiers.TIER_4.min;
            nextDiscount = tiers.TIER_4.discount;
        }
        else {
            return null; // Already at max tier
        }
        // Only show if close to next tier (within 30%)
        const conversationsNeeded = nextThreshold - uniqueConversations;
        const percentageToNext = uniqueConversations / nextThreshold;
        if (percentageToNext < 0.7) {
            return null;
        }
        const additionalDiscount = nextDiscount - currentDiscount;
        const potentialSavings = analysis.totalCost * additionalDiscount;
        const savingsPercentage = additionalDiscount * 100;
        return {
            id: '',
            title: 'Reach Next Volume Discount Tier',
            description: `You're ${conversationsNeeded} conversations away from the ${(0, helpers_1.round)(nextDiscount * 100)}% volume discount tier. Increasing your message volume could save ${(0, helpers_1.round)(savingsPercentage)}% on all future messages.`,
            potentialSavings: (0, helpers_1.round)(potentialSavings, 2),
            savingsPercentage: (0, helpers_1.round)(savingsPercentage, 1),
            priority: percentageToNext > 0.9 ? 'high' : 'medium',
            actionable: true,
            steps: [
                'Increase customer engagement through automated welcome messages',
                'Launch re-engagement campaigns to inactive customers',
                'Enable more automation triggers for routine communications',
                'Consider promotional campaigns to boost conversation volume',
            ],
            category: 'volume',
            implemented: false,
        };
    }
    /**
     * Analyze template usage patterns
     */
    analyzeTemplateUsage(messages, analysis) {
        // Check for high marketing template usage
        const marketingMessages = messages.filter((m) => m.category === client_1.MessageCategory.MARKETING);
        const marketingPercentage = (0, helpers_1.percentage)(marketingMessages.length, messages.length);
        if (marketingPercentage < 40) {
            return null;
        }
        const potentialSavings = analysis.totalCost * 0.1; // Conservative estimate
        return {
            id: '',
            title: 'Optimize Template Categories',
            description: `${(0, helpers_1.round)(marketingPercentage)}% of your messages are categorized as marketing. Review your templates to ensure only promotional content uses marketing templates.`,
            potentialSavings: (0, helpers_1.round)(potentialSavings, 2),
            savingsPercentage: 10,
            priority: 'medium',
            actionable: true,
            steps: [
                'Audit all message templates and their categories',
                'Move non-promotional templates to utility or service categories',
                'Create separate templates for different message types',
                'Work with your BSP to recategorize templates if needed',
            ],
            category: 'template',
            implemented: false,
        };
    }
    /**
     * Analyze peak time patterns
     */
    analyzePeakTimePatterns(messages, analysis) {
        // Group messages by hour
        const messagesByHour = (0, helpers_1.groupBy)(messages, (m) => {
            return m.timestamp.getUTCHours().toString();
        });
        // Find peak hours (top 3 hours with most messages)
        const hourCounts = Object.entries(messagesByHour)
            .map(([hour, msgs]) => ({ hour: parseInt(hour), count: msgs.length }))
            .sort((a, b) => b.count - a.count);
        const peakHours = hourCounts.slice(0, 3);
        const totalPeakMessages = peakHours.reduce((sum, h) => sum + h.count, 0);
        const peakPercentage = (0, helpers_1.percentage)(totalPeakMessages, messages.length);
        // Only recommend if messages are heavily concentrated
        if (peakPercentage < 50) {
            return null;
        }
        return {
            id: '',
            title: 'Spread Message Distribution',
            description: `${(0, helpers_1.round)(peakPercentage)}% of your messages are sent during peak hours (${peakHours.map((h) => `${h.hour}:00`).join(', ')}). Spreading messages could improve customer response rates and enable better window utilization.`,
            potentialSavings: (0, helpers_1.round)(analysis.totalCost * 0.05, 2),
            savingsPercentage: 5,
            priority: 'low',
            actionable: true,
            steps: [
                'Analyze customer activity patterns to find optimal send times',
                'Implement message scheduling to spread sends throughout the day',
                'Test different time windows for marketing campaigns',
                'Consider timezone-based sending for better engagement',
            ],
            category: 'timing',
            implemented: false,
        };
    }
    /**
     * Analyze conversation metrics
     */
    analyzeConversations(messages) {
        const conversations = (0, helpers_1.groupBy)(messages, (m) => m.conversationId || m.id);
        const conversationSizes = Object.values(conversations).map((msgs) => msgs.length);
        const avgMessagesPerConversation = conversationSizes.length > 0
            ? conversationSizes.reduce((a, b) => a + b, 0) / conversationSizes.length
            : 0;
        const freeWindowMessages = messages.filter((m) => m.isInFreeWindow).length;
        const outboundMessages = messages.filter((m) => m.direction === 'OUTBOUND').length;
        const freeWindowUtilization = outboundMessages > 0 ? freeWindowMessages / outboundMessages : 0;
        // Estimate customer vs business initiated (simplified)
        const conversationsStartedByCustomer = Object.values(conversations).filter((msgs) => msgs[0]?.direction === 'INBOUND').length;
        const conversationsStartedByBusiness = Object.keys(conversations).length - conversationsStartedByCustomer;
        return {
            avgMessagesPerConversation,
            freeWindowUtilization,
            conversationsStartedByCustomer,
            conversationsStartedByBusiness,
        };
    }
    /**
     * Get rate for a category
     */
    getRate(category) {
        const rates = constants_1.WA_PRICING.COUNTRY_RATES[this.country]
            || constants_1.WA_PRICING.CATEGORIES;
        switch (category) {
            case client_1.MessageCategory.AUTHENTICATION:
                return rates.AUTHENTICATION;
            case client_1.MessageCategory.MARKETING:
                return rates.MARKETING;
            case client_1.MessageCategory.UTILITY:
                return rates.UTILITY;
            case client_1.MessageCategory.SERVICE:
                return rates.SERVICE;
            default:
                return 0;
        }
    }
    /**
     * Calculate optimization score (0-100)
     */
    calculateOptimizationScore(messages, analysis) {
        let score = 100;
        // Deduct for marketing messages outside free window
        const marketingOutside = messages.filter((m) => m.category === client_1.MessageCategory.MARKETING &&
            !m.isInFreeWindow &&
            m.direction === 'OUTBOUND');
        const marketingOutsideRatio = marketingOutside.length / Math.max(messages.length, 1);
        score -= marketingOutsideRatio * 30;
        // Deduct for low conversation utilization
        const metrics = this.analyzeConversations(messages);
        if (metrics.avgMessagesPerConversation < 2) {
            score -= 15;
        }
        else if (metrics.avgMessagesPerConversation < 3) {
            score -= 8;
        }
        // Deduct for low free window utilization
        if (metrics.freeWindowUtilization < 0.3) {
            score -= 20;
        }
        else if (metrics.freeWindowUtilization < 0.5) {
            score -= 10;
        }
        // Bonus for high authentication ratio (free messages)
        const authMessages = messages.filter((m) => m.category === client_1.MessageCategory.AUTHENTICATION);
        if (authMessages.length / messages.length > 0.1) {
            score += 5;
        }
        // Cap score between 0 and 100
        return Math.max(0, Math.min(100, Math.round(score)));
    }
}
exports.CostOptimizer = CostOptimizer;
exports.default = CostOptimizer;
//# sourceMappingURL=optimizer.js.map