"use strict";
// =============================================================================
// MessageWise Optimizer - Cost Calculator Service
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostCalculator = void 0;
const client_1 = require("@prisma/client");
const constants_1 = require("../../config/constants");
const helpers_1 = require("../../utils/helpers");
const logger_1 = __importDefault(require("../../utils/logger"));
class CostCalculator {
    country;
    currency;
    constructor(country = 'ID', currency = 'USD') {
        this.country = country;
        this.currency = currency;
    }
    /**
     * Calculate total cost for a set of messages
     */
    calculateCost(messages, options = {}) {
        const startTime = Date.now();
        const { country = this.country, currency = this.currency, applyVolumeDiscounts = true, includeFreeTier = true, } = options;
        // Initialize breakdown
        const breakdown = {
            [client_1.MessageCategory.AUTHENTICATION]: { count: 0, cost: 0 },
            [client_1.MessageCategory.MARKETING]: { count: 0, cost: 0 },
            [client_1.MessageCategory.UTILITY]: { count: 0, cost: 0 },
            [client_1.MessageCategory.SERVICE]: { count: 0, cost: 0 },
        };
        let freeMessages = 0;
        let paidMessages = 0;
        // Calculate unique conversations for volume discount
        const uniqueConversations = new Set();
        // Process each message
        for (const msg of messages) {
            breakdown[msg.category].count++;
            // Track conversation IDs
            if (msg.conversationId) {
                uniqueConversations.add(msg.conversationId);
            }
            // Determine if message is free
            const isFree = this.isMessageFree(msg, includeFreeTier);
            if (isFree) {
                freeMessages++;
            }
            else {
                paidMessages++;
                const cost = this.getMessageCost(msg.category, country);
                breakdown[msg.category].cost += cost;
            }
        }
        // Calculate total before discounts
        let totalCost = Object.values(breakdown).reduce((sum, item) => sum + item.cost, 0);
        // Apply volume discounts if applicable
        if (applyVolumeDiscounts && uniqueConversations.size > 0) {
            const discount = this.getVolumeDiscount(uniqueConversations.size);
            totalCost = totalCost * (1 - discount.discount);
            // Apply discount to each category
            for (const category of Object.values(client_1.MessageCategory)) {
                breakdown[category].cost = breakdown[category].cost * (1 - discount.discount);
            }
        }
        // Build response
        const result = {
            totalCost: (0, helpers_1.round)(totalCost, 4),
            messageCount: messages.length,
            breakdown: this.buildCategoryBreakdown(breakdown, messages.length),
            freeMessages,
            paidMessages,
            currency,
        };
        const duration = Date.now() - startTime;
        logger_1.default.debug('Cost calculation completed', {
            messageCount: messages.length,
            totalCost: result.totalCost,
            duration: `${duration}ms`,
        });
        return result;
    }
    /**
     * Calculate cost with volume discounts explicitly shown
     */
    calculateWithDiscountBreakdown(messages, options = {}) {
        // Calculate without discounts first
        const withoutDiscount = this.calculateCost(messages, {
            ...options,
            applyVolumeDiscounts: false,
        });
        // Calculate with discounts
        const withDiscount = this.calculateCost(messages, {
            ...options,
            applyVolumeDiscounts: true,
        });
        // Get the discount info
        const uniqueConversations = new Set(messages.map((m) => m.conversationId).filter(Boolean));
        const discount = this.getVolumeDiscount(uniqueConversations.size);
        return {
            ...withDiscount,
            discountApplied: discount,
            originalCost: withoutDiscount.totalCost,
        };
    }
    /**
     * Calculate daily costs for a period
     */
    calculateDailyCosts(messages) {
        // Group messages by day
        const messagesByDay = new Map();
        for (const msg of messages) {
            const dateKey = msg.timestamp.toISOString().split('T')[0];
            if (!messagesByDay.has(dateKey)) {
                messagesByDay.set(dateKey, []);
            }
            messagesByDay.get(dateKey).push(msg);
        }
        // Calculate cost for each day
        const dailyCosts = new Map();
        for (const [date, dayMessages] of messagesByDay) {
            dailyCosts.set(date, this.calculateCost(dayMessages));
        }
        return dailyCosts;
    }
    /**
     * Calculate potential savings if optimizations are applied
     */
    calculatePotentialSavings(messages) {
        const savings = [];
        let totalPotentialSavings = 0;
        // 1. Marketing messages that could be sent in service window
        const marketingOutsideWindow = messages.filter((m) => m.category === client_1.MessageCategory.MARKETING &&
            !m.isInFreeWindow &&
            m.direction === 'OUTBOUND');
        if (marketingOutsideWindow.length > 0) {
            const marketingCost = marketingOutsideWindow.length * this.getMessageCost(client_1.MessageCategory.MARKETING);
            savings.push({
                category: 'timing',
                description: `Send ${marketingOutsideWindow.length} marketing messages within 24h window`,
                savings: (0, helpers_1.round)(marketingCost, 4),
            });
            totalPotentialSavings += marketingCost;
        }
        // 2. Messages that could be reclassified as utility
        const potentialUtility = messages.filter((m) => m.category === client_1.MessageCategory.MARKETING &&
            !m.isInFreeWindow &&
            m.direction === 'OUTBOUND');
        if (potentialUtility.length > 0) {
            const marketingRate = this.getMessageCost(client_1.MessageCategory.MARKETING);
            const utilityRate = this.getMessageCost(client_1.MessageCategory.UTILITY);
            const savingsPerMessage = marketingRate - utilityRate;
            const reclassifySavings = potentialUtility.length * savingsPerMessage * 0.3; // Assume 30% can be reclassified
            if (reclassifySavings > 0) {
                savings.push({
                    category: 'classification',
                    description: `Reclassify ~${Math.round(potentialUtility.length * 0.3)} messages as utility`,
                    savings: (0, helpers_1.round)(reclassifySavings, 4),
                });
                totalPotentialSavings += reclassifySavings;
            }
        }
        // 3. Volume discount opportunity
        const conversations = new Set(messages.map((m) => m.conversationId).filter(Boolean));
        const currentDiscount = this.getVolumeDiscount(conversations.size);
        const nextTier = this.getNextVolumeTier(conversations.size);
        if (nextTier && currentDiscount.discount < nextTier.discount) {
            const currentCost = this.calculateCost(messages, { applyVolumeDiscounts: true }).totalCost;
            const additionalDiscount = nextTier.discount - currentDiscount.discount;
            const volumeSavings = currentCost * additionalDiscount;
            savings.push({
                category: 'volume',
                description: `Reach ${nextTier.threshold} conversations for ${(0, helpers_1.round)(nextTier.discount * 100)}% discount`,
                savings: (0, helpers_1.round)(volumeSavings, 4),
            });
            totalPotentialSavings += volumeSavings;
        }
        return {
            totalPotentialSavings: (0, helpers_1.round)(totalPotentialSavings, 4),
            breakdown: savings,
        };
    }
    /**
     * Compare costs between two periods
     */
    comparePeriods(currentMessages, previousMessages) {
        const current = this.calculateCost(currentMessages);
        const previous = this.calculateCost(previousMessages);
        const costChange = current.totalCost - previous.totalCost;
        const costChangePercentage = (0, helpers_1.percentageChange)(current.totalCost, previous.totalCost);
        const messageChange = current.messageCount - previous.messageCount;
        const messageChangePercentage = (0, helpers_1.percentageChange)(current.messageCount, previous.messageCount);
        return {
            current,
            previous,
            costTrend: {
                current: current.totalCost,
                previous: previous.totalCost,
                change: costChange,
                changePercentage: costChangePercentage,
                trend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'stable',
            },
            messageTrend: {
                current: current.messageCount,
                previous: previous.messageCount,
                change: messageChange,
                changePercentage: messageChangePercentage,
                trend: messageChange > 0 ? 'up' : messageChange < 0 ? 'down' : 'stable',
            },
        };
    }
    /**
     * Get cost per message for a category
     */
    getMessageCost(category, country) {
        const countryCode = country || this.country;
        const rates = constants_1.WA_PRICING.COUNTRY_RATES[countryCode]
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
     * Check if a message is free
     */
    isMessageFree(msg, includeFreeTier) {
        // Inbound messages are always free
        if (msg.direction === 'INBOUND') {
            return true;
        }
        // Authentication is always free
        if (msg.category === client_1.MessageCategory.AUTHENTICATION) {
            return true;
        }
        // Messages in free service window
        if (msg.isInFreeWindow) {
            return true;
        }
        return false;
    }
    /**
     * Get volume discount based on conversation count
     */
    getVolumeDiscount(conversationCount) {
        const tiers = constants_1.WA_PRICING.VOLUME_DISCOUNTS;
        if (conversationCount > tiers.TIER_4.min) {
            return { tier: 'TIER_4', discount: tiers.TIER_4.discount, threshold: tiers.TIER_4.min };
        }
        if (conversationCount > tiers.TIER_3.min) {
            return { tier: 'TIER_3', discount: tiers.TIER_3.discount, threshold: tiers.TIER_3.min };
        }
        if (conversationCount > tiers.TIER_2.min) {
            return { tier: 'TIER_2', discount: tiers.TIER_2.discount, threshold: tiers.TIER_2.min };
        }
        return { tier: 'TIER_1', discount: tiers.TIER_1.discount, threshold: tiers.TIER_1.min };
    }
    /**
     * Get next volume tier for upgrade opportunity
     */
    getNextVolumeTier(conversationCount) {
        const tiers = constants_1.WA_PRICING.VOLUME_DISCOUNTS;
        if (conversationCount <= tiers.TIER_1.max) {
            return { tier: 'TIER_2', discount: tiers.TIER_2.discount, threshold: tiers.TIER_2.min };
        }
        if (conversationCount <= tiers.TIER_2.max) {
            return { tier: 'TIER_3', discount: tiers.TIER_3.discount, threshold: tiers.TIER_3.min };
        }
        if (conversationCount <= tiers.TIER_3.max) {
            return { tier: 'TIER_4', discount: tiers.TIER_4.discount, threshold: tiers.TIER_4.min };
        }
        return null; // Already at highest tier
    }
    /**
     * Build category breakdown array
     */
    buildCategoryBreakdown(breakdown, totalMessages) {
        return Object.entries(breakdown).map(([category, data]) => ({
            category: category,
            count: data.count,
            cost: (0, helpers_1.round)(data.cost, 4),
            avgCostPerMessage: data.count > 0 ? (0, helpers_1.round)(data.cost / data.count, 6) : 0,
            percentage: (0, helpers_1.percentage)(data.count, totalMessages),
        }));
    }
    /**
     * Estimate monthly cost based on current usage
     */
    estimateMonthlyCost(dailyMessages, daysInSample) {
        const dailyCost = this.calculateCost(dailyMessages);
        const avgDailyCost = dailyCost.totalCost / Math.max(daysInSample, 1);
        const avgDailyMessages = dailyMessages.length / Math.max(daysInSample, 1);
        const estimatedMonthlyCost = (0, helpers_1.round)(avgDailyCost * 30, 2);
        const estimatedMonthlyMessages = Math.round(avgDailyMessages * 30);
        // Calculate potential monthly savings
        const potentialSavings = this.calculatePotentialSavings(dailyMessages);
        const projectedSavings = (0, helpers_1.round)((potentialSavings.totalPotentialSavings / Math.max(daysInSample, 1)) * 30, 2);
        return {
            estimatedMonthlyCost,
            estimatedMonthlyMessages,
            projectedSavings,
        };
    }
}
exports.CostCalculator = CostCalculator;
exports.default = CostCalculator;
//# sourceMappingURL=costCalculator.js.map