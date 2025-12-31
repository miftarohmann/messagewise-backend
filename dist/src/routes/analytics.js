"use strict";
// =============================================================================
// MessageWise Optimizer - Analytics Routes
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const rateLimiter_1 = require("../middleware/rateLimiter");
const costCalculator_1 = require("../services/analyzer/costCalculator");
const optimizer_1 = require("../services/analyzer/optimizer");
const savingsPredictor_1 = require("../services/analyzer/savingsPredictor");
const helpers_1 = require("../utils/helpers");
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * GET /api/analytics/summary
 * Get analytics summary for dashboard
 */
router.get('/summary', auth_1.authenticate, (0, validator_1.validate)(validator_1.analyticsValidation.summary), async (req, res) => {
    try {
        const { accountId, startDate, endDate } = req.query;
        // Build where clause for messages
        const messageWhere = {
            account: { userId: req.user.userId },
        };
        if (accountId) {
            messageWhere.accountId = accountId;
        }
        const start = startDate ? new Date(startDate) : (0, helpers_1.startOfMonth)();
        const end = endDate ? new Date(endDate) : (0, helpers_1.endOfDay)();
        messageWhere.timestamp = {
            gte: start,
            lte: end,
        };
        // Get messages directly from messages table
        const messages = await database_1.db.message.findMany({
            where: messageWhere,
            orderBy: { timestamp: 'asc' },
        });
        logger_1.default.info('Analytics summary query', {
            userId: req.user.userId,
            accountId,
            start: start.toISOString(),
            end: end.toISOString(),
            messageCount: messages.length,
        });
        // Calculate totals from messages
        const totalMessages = messages.length;
        const totalCost = messages.reduce((sum, m) => sum + (m.cost || 0), 0);
        const freeMessages = messages.filter(m => m.isInFreeWindow || m.direction === 'INBOUND').length;
        const paidMessages = totalMessages - freeMessages;
        // Calculate potential savings (messages that could have been free)
        const potentialSavings = messages
            .filter(m => m.cost > 0 && !m.isInFreeWindow)
            .reduce((sum, m) => sum + m.cost * 0.3, 0); // Estimate 30% could be optimized
        // Calculate category breakdown
        const categoryBreakdown = {
            MARKETING: { count: 0, cost: 0 },
            UTILITY: { count: 0, cost: 0 },
            AUTHENTICATION: { count: 0, cost: 0 },
            SERVICE: { count: 0, cost: 0 },
        };
        messages.forEach(m => {
            const cat = m.category || 'SERVICE';
            if (categoryBreakdown[cat]) {
                categoryBreakdown[cat].count++;
                categoryBreakdown[cat].cost += m.cost || 0;
            }
        });
        const messagesByCategory = Object.entries(categoryBreakdown).map(([category, data]) => ({
            category,
            count: data.count,
            cost: data.cost,
        }));
        // Calculate daily trend
        const dailyMap = new Map();
        messages.forEach(m => {
            const dateStr = m.timestamp.toISOString().split('T')[0];
            const existing = dailyMap.get(dateStr) || { date: dateStr, messages: 0, cost: 0 };
            existing.messages++;
            existing.cost += m.cost || 0;
            dailyMap.set(dateStr, existing);
        });
        const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        // Generate simple recommendations based on data
        const recommendations = [];
        const marketingCount = categoryBreakdown.MARKETING.count;
        const marketingCost = categoryBreakdown.MARKETING.cost;
        if (marketingCost > totalCost * 0.4) {
            recommendations.push({
                id: 'rec_marketing',
                title: 'Optimize Marketing Messages',
                description: `Marketing messages account for ${Math.round((marketingCost / totalCost) * 100)}% of your costs. Consider using the 24-hour free window more effectively.`,
                potentialSavings: marketingCost * 0.25,
                priority: 'high',
            });
        }
        if (paidMessages > totalMessages * 0.6) {
            recommendations.push({
                id: 'rec_free_window',
                title: 'Leverage Free Conversation Window',
                description: 'Most of your messages are outside the free window. Respond to customers within 24 hours to maximize free messages.',
                potentialSavings: totalCost * 0.2,
                priority: 'medium',
            });
        }
        // Calculate optimization score (0-100)
        const freeRatio = totalMessages > 0 ? freeMessages / totalMessages : 0;
        const optimizationScore = Math.round(freeRatio * 100);
        // Get previous period for comparison
        const periodLength = end.getTime() - start.getTime();
        const previousStart = new Date(start.getTime() - periodLength);
        const previousEnd = new Date(start.getTime() - 1);
        const previousMessages = await database_1.db.message.findMany({
            where: {
                ...messageWhere,
                timestamp: {
                    gte: previousStart,
                    lte: previousEnd,
                },
            },
        });
        const previousTotalCost = previousMessages.reduce((sum, m) => sum + (m.cost || 0), 0);
        const previousTotalMessages = previousMessages.length;
        const costChange = previousTotalCost > 0
            ? ((totalCost - previousTotalCost) / previousTotalCost) * 100
            : 0;
        const messageChange = previousTotalMessages > 0
            ? ((totalMessages - previousTotalMessages) / previousTotalMessages) * 100
            : 0;
        res.json({
            success: true,
            data: {
                totalCost,
                totalMessages,
                potentialSavings,
                actualSavings: 0,
                savingsPercentage: totalCost > 0 ? (potentialSavings / totalCost) * 100 : 0,
                optimizationScore,
                costChange,
                messageChange,
                period: { start, end },
                // Additional fields for dashboard
                messagesByCategory,
                dailyTrend,
                recommendations,
                freeMessages,
                paidMessages,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get analytics summary failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get analytics summary',
            },
        });
    }
});
/**
 * GET /api/analytics/:accountId/breakdown
 * Get detailed cost breakdown
 */
router.get('/:accountId/breakdown', auth_1.authenticate, rateLimiter_1.analysisRateLimiter, (0, validator_1.validate)(validator_1.analyticsValidation.breakdown), async (req, res) => {
    try {
        const { accountId } = req.params;
        const { startDate, endDate, groupBy = 'day' } = req.query;
        // Verify access
        const account = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Get messages for the period
        const messages = await database_1.db.message.findMany({
            where: {
                accountId,
                timestamp: {
                    gte: start,
                    lte: end,
                },
            },
            orderBy: { timestamp: 'asc' },
        });
        // Calculate breakdown
        const calculator = new costCalculator_1.CostCalculator();
        const breakdown = calculator.calculateCost(messages.map((m) => ({
            category: m.category,
            isInFreeWindow: m.isInFreeWindow,
            direction: m.direction,
            timestamp: m.timestamp,
            conversationId: m.conversationId || undefined,
        })));
        // Group by period
        const dailyCosts = calculator.calculateDailyCosts(messages.map((m) => ({
            category: m.category,
            isInFreeWindow: m.isInFreeWindow,
            direction: m.direction,
            timestamp: m.timestamp,
            conversationId: m.conversationId || undefined,
        })));
        const dailyData = Array.from(dailyCosts.entries()).map(([date, cost]) => ({
            date,
            ...cost,
        }));
        res.json({
            success: true,
            data: {
                summary: breakdown,
                daily: dailyData,
                period: { start, end },
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get cost breakdown failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get cost breakdown',
            },
        });
    }
});
/**
 * GET /api/analytics/:accountId/recommendations
 * Get optimization recommendations
 */
router.get('/:accountId/recommendations', auth_1.authenticate, async (req, res) => {
    try {
        const { accountId } = req.params;
        // Verify access
        const account = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        // Get recent messages
        const messages = await database_1.db.message.findMany({
            where: {
                accountId,
                timestamp: { gte: (0, helpers_1.daysAgo)(30) },
            },
        });
        if (messages.length === 0) {
            res.json({
                success: true,
                data: {
                    recommendations: [],
                    optimizationScore: 0,
                },
            });
            return;
        }
        // Calculate analysis
        const calculator = new costCalculator_1.CostCalculator();
        const breakdown = calculator.calculateCost(messages.map((m) => ({
            category: m.category,
            isInFreeWindow: m.isInFreeWindow,
            direction: m.direction,
            timestamp: m.timestamp,
            conversationId: m.conversationId || undefined,
        })));
        // Generate recommendations
        const optimizer = new optimizer_1.CostOptimizer();
        const recommendations = optimizer.generateRecommendations(messages.map((m) => ({
            id: m.id,
            category: m.category,
            isInFreeWindow: m.isInFreeWindow,
            direction: m.direction,
            timestamp: m.timestamp,
            conversationId: m.conversationId || undefined,
            cost: m.cost,
        })), {
            totalCost: breakdown.totalCost,
            totalMessages: breakdown.messageCount,
            freeMessages: breakdown.freeMessages,
            paidMessages: breakdown.paidMessages,
            breakdown: breakdown.breakdown.map((b) => ({
                category: b.category,
                count: b.count,
                cost: b.cost,
            })),
        });
        const optimizationScore = optimizer.calculateOptimizationScore(messages.map((m) => ({
            id: m.id,
            category: m.category,
            isInFreeWindow: m.isInFreeWindow,
            direction: m.direction,
            timestamp: m.timestamp,
            conversationId: m.conversationId || undefined,
            cost: m.cost,
        })), {
            totalCost: breakdown.totalCost,
            totalMessages: breakdown.messageCount,
            freeMessages: breakdown.freeMessages,
            paidMessages: breakdown.paidMessages,
            breakdown: breakdown.breakdown.map((b) => ({
                category: b.category,
                count: b.count,
                cost: b.cost,
            })),
        });
        res.json({
            success: true,
            data: {
                recommendations,
                optimizationScore,
                totalPotentialSavings: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0),
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get recommendations failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get recommendations',
            },
        });
    }
});
/**
 * GET /api/analytics/:accountId/trends
 * Get cost trends over time
 */
router.get('/:accountId/trends', auth_1.authenticate, (0, validator_1.validate)(validator_1.analyticsValidation.trends), async (req, res) => {
    try {
        const { accountId } = req.params;
        const { period = '30d' } = req.query;
        // Verify access
        const account = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        const periodDays = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '1y': 365,
        };
        const days = periodDays[period] || 30;
        const start = (0, helpers_1.daysAgo)(days);
        // Get daily analyses
        const analyses = await database_1.db.costAnalysis.findMany({
            where: {
                accountId,
                periodType: 'DAILY',
                periodStart: { gte: start },
            },
            orderBy: { periodStart: 'asc' },
        });
        const trends = analyses.map((a) => ({
            date: a.periodStart.toISOString().split('T')[0],
            cost: a.totalCost,
            messages: a.totalMessages,
            freeMessages: a.freeMessages,
            paidMessages: a.paidMessages,
            optimizationScore: a.optimizationScore,
            potentialSavings: a.potentialSavings,
        }));
        res.json({
            success: true,
            data: {
                trends,
                period: { start, end: new Date() },
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get trends failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get trends',
            },
        });
    }
});
/**
 * GET /api/analytics/:accountId/forecast
 * Get savings forecast
 */
router.get('/:accountId/forecast', auth_1.authenticate, async (req, res) => {
    try {
        const { accountId } = req.params;
        const { months = 6 } = req.query;
        // Verify access
        const account = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        // Get historical data
        const analyses = await database_1.db.costAnalysis.findMany({
            where: {
                accountId,
                periodType: 'DAILY',
                periodStart: { gte: (0, helpers_1.daysAgo)(90) },
            },
            orderBy: { periodStart: 'asc' },
        });
        if (analyses.length < 7) {
            res.json({
                success: true,
                data: {
                    forecast: [],
                    message: 'Not enough data for forecast. Need at least 7 days.',
                },
            });
            return;
        }
        // Generate forecast
        const predictor = new savingsPredictor_1.SavingsPredictor();
        const historicalData = analyses.map((a) => ({
            date: a.periodStart,
            totalCost: a.totalCost,
            totalMessages: a.totalMessages,
            freeMessages: a.freeMessages,
            paidMessages: a.paidMessages,
            breakdown: a.breakdown,
            actualSavings: a.actualSavings,
        }));
        const forecast = predictor.generateForecast(historicalData, parseInt(months));
        res.json({
            success: true,
            data: { forecast },
        });
    }
    catch (error) {
        logger_1.default.error('Get forecast failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get forecast',
            },
        });
    }
});
/**
 * GET /api/analytics/:accountId/category-trends
 * Get category-wise trends
 */
router.get('/:accountId/category-trends', auth_1.authenticate, async (req, res) => {
    try {
        const { accountId } = req.params;
        // Verify access
        const account = await database_1.db.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });
        if (!account) {
            res.status(404).json({
                success: false,
                error: {
                    code: constants_1.ERROR_CODES.RESOURCE_NOT_FOUND,
                    message: 'Account not found',
                },
            });
            return;
        }
        // Get daily analyses with breakdowns
        const analyses = await database_1.db.costAnalysis.findMany({
            where: {
                accountId,
                periodType: 'DAILY',
                periodStart: { gte: (0, helpers_1.daysAgo)(30) },
            },
            orderBy: { periodStart: 'asc' },
        });
        // Extract category data
        const categoryData = {
            MARKETING: [],
            UTILITY: [],
            AUTHENTICATION: [],
            SERVICE: [],
        };
        analyses.forEach((a) => {
            const breakdown = a.breakdown;
            const date = a.periodStart.toISOString().split('T')[0];
            breakdown.forEach((item) => {
                if (categoryData[item.category]) {
                    categoryData[item.category].push({
                        date,
                        count: item.count,
                        cost: item.cost,
                    });
                }
            });
        });
        res.json({
            success: true,
            data: { categoryTrends: categoryData },
        });
    }
    catch (error) {
        logger_1.default.error('Get category trends failed', { error });
        res.status(500).json({
            success: false,
            error: {
                code: constants_1.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to get category trends',
            },
        });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map