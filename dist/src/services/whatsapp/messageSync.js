"use strict";
// =============================================================================
// MessageWise Optimizer - Message Sync Service
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageSyncService = void 0;
const client_1 = require("@prisma/client");
const database_1 = require("../../config/database");
const apiClient_1 = require("./apiClient");
const messageClassifier_1 = require("../analyzer/messageClassifier");
const costCalculator_1 = require("../analyzer/costCalculator");
const optimizer_1 = require("../analyzer/optimizer");
const helpers_1 = require("../../utils/helpers");
const logger_1 = __importDefault(require("../../utils/logger"));
class MessageSyncService {
    classifier;
    calculator;
    optimizer;
    constructor() {
        this.classifier = new messageClassifier_1.MessageClassifier();
        this.calculator = new costCalculator_1.CostCalculator();
        this.optimizer = new optimizer_1.CostOptimizer();
    }
    /**
     * Sync messages for an account
     */
    async syncAccount(accountId) {
        const result = {
            success: false,
            messagesProcessed: 0,
            analysisGenerated: false,
            errors: [],
        };
        try {
            // Get account
            const account = await database_1.db.account.findUnique({
                where: { id: accountId },
            });
            if (!account) {
                result.errors.push('Account not found');
                return result;
            }
            // Update sync status
            await database_1.db.account.update({
                where: { id: accountId },
                data: { syncStatus: client_1.SyncStatus.SYNCING },
            });
            // Create API client
            const apiClient = new apiClient_1.WhatsAppApiClient(account.waPhoneNumberId, account.waAccessToken);
            // Verify account is still active
            const verification = await apiClient.verifyPhoneNumber();
            if (!verification.verified) {
                result.errors.push('Account is not verified');
                await database_1.db.account.update({
                    where: { id: accountId },
                    data: {
                        syncStatus: client_1.SyncStatus.FAILED,
                        isVerified: false,
                    },
                });
                return result;
            }
            // Sync analytics data from WhatsApp API
            const endDate = new Date();
            const startDate = account.lastSyncAt || (0, helpers_1.daysAgo)(7);
            try {
                const analytics = await apiClient.getConversationAnalytics(startDate, endDate);
                // Process analytics data
                // Note: This is supplementary data, main messages come from webhooks
                logger_1.default.debug('Analytics data retrieved', {
                    accountId,
                    dataPoints: analytics.data.length,
                });
            }
            catch (error) {
                logger_1.default.warn('Could not fetch analytics data', { accountId, error });
                // Continue with sync even if analytics fails
            }
            // Generate analysis for existing messages
            const analysisResult = await this.generateDailyAnalysis(accountId, endDate);
            result.analysisGenerated = analysisResult;
            // Update account status
            await database_1.db.account.update({
                where: { id: accountId },
                data: {
                    syncStatus: client_1.SyncStatus.COMPLETED,
                    lastSyncAt: new Date(),
                    isVerified: true,
                },
            });
            result.success = true;
            logger_1.default.info('Account sync completed', {
                accountId,
                messagesProcessed: result.messagesProcessed,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Account sync failed', { accountId, error });
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
            await database_1.db.account.update({
                where: { id: accountId },
                data: { syncStatus: client_1.SyncStatus.FAILED },
            });
            return result;
        }
    }
    /**
     * Generate daily cost analysis
     */
    async generateDailyAnalysis(accountId, date = new Date()) {
        try {
            const periodStart = (0, helpers_1.startOfDay)(date);
            const periodEnd = (0, helpers_1.endOfDay)(date);
            // Get messages for the day
            const messages = await database_1.db.message.findMany({
                where: {
                    accountId,
                    timestamp: {
                        gte: periodStart,
                        lte: periodEnd,
                    },
                },
            });
            if (messages.length === 0) {
                logger_1.default.debug('No messages to analyze', { accountId, date });
                return false;
            }
            // Calculate costs
            const costData = this.calculator.calculateCost(messages.map((m) => ({
                category: m.category,
                isInFreeWindow: m.isInFreeWindow,
                direction: m.direction,
                timestamp: m.timestamp,
                conversationId: m.conversationId || undefined,
            })));
            // Generate recommendations
            const recommendations = this.optimizer.generateRecommendations(messages.map((m) => ({
                id: m.id,
                category: m.category,
                isInFreeWindow: m.isInFreeWindow,
                direction: m.direction,
                timestamp: m.timestamp,
                conversationId: m.conversationId || undefined,
                cost: m.cost,
            })), {
                totalCost: costData.totalCost,
                totalMessages: costData.messageCount,
                freeMessages: costData.freeMessages,
                paidMessages: costData.paidMessages,
                breakdown: costData.breakdown.map((b) => ({
                    category: b.category,
                    count: b.count,
                    cost: b.cost,
                })),
            });
            // Calculate optimization score
            const optimizationScore = this.optimizer.calculateOptimizationScore(messages.map((m) => ({
                id: m.id,
                category: m.category,
                isInFreeWindow: m.isInFreeWindow,
                direction: m.direction,
                timestamp: m.timestamp,
                conversationId: m.conversationId || undefined,
                cost: m.cost,
            })), {
                totalCost: costData.totalCost,
                totalMessages: costData.messageCount,
                freeMessages: costData.freeMessages,
                paidMessages: costData.paidMessages,
                breakdown: costData.breakdown.map((b) => ({
                    category: b.category,
                    count: b.count,
                    cost: b.cost,
                })),
            });
            // Calculate potential savings
            const potentialSavings = recommendations.reduce((sum, r) => sum + r.potentialSavings, 0);
            // Get previous period for comparison
            const previousStart = (0, helpers_1.startOfDay)((0, helpers_1.daysAgo)(1, date));
            const previousEnd = (0, helpers_1.endOfDay)((0, helpers_1.daysAgo)(1, date));
            const previousAnalysis = await database_1.db.costAnalysis.findFirst({
                where: {
                    accountId,
                    periodStart: previousStart,
                    periodType: client_1.PeriodType.DAILY,
                },
            });
            const costChange = previousAnalysis
                ? costData.totalCost - previousAnalysis.totalCost
                : null;
            const messageChange = previousAnalysis
                ? costData.messageCount - previousAnalysis.totalMessages
                : null;
            // Upsert analysis
            await database_1.db.costAnalysis.upsert({
                where: {
                    accountId_periodStart_periodType: {
                        accountId,
                        periodStart,
                        periodType: client_1.PeriodType.DAILY,
                    },
                },
                create: {
                    accountId,
                    periodStart,
                    periodEnd,
                    periodType: client_1.PeriodType.DAILY,
                    totalMessages: costData.messageCount,
                    inboundMessages: messages.filter((m) => m.direction === 'INBOUND').length,
                    outboundMessages: messages.filter((m) => m.direction === 'OUTBOUND').length,
                    freeMessages: costData.freeMessages,
                    paidMessages: costData.paidMessages,
                    totalCost: costData.totalCost,
                    estimatedCost: costData.totalCost,
                    potentialSavings,
                    actualSavings: 0,
                    breakdown: JSON.parse(JSON.stringify(costData.breakdown)),
                    optimizationScore,
                    recommendations: JSON.parse(JSON.stringify(recommendations.slice(0, 5))),
                    costChange,
                    messageChange,
                },
                update: {
                    periodEnd,
                    totalMessages: costData.messageCount,
                    inboundMessages: messages.filter((m) => m.direction === 'INBOUND').length,
                    outboundMessages: messages.filter((m) => m.direction === 'OUTBOUND').length,
                    freeMessages: costData.freeMessages,
                    paidMessages: costData.paidMessages,
                    totalCost: costData.totalCost,
                    estimatedCost: costData.totalCost,
                    potentialSavings,
                    breakdown: JSON.parse(JSON.stringify(costData.breakdown)),
                    optimizationScore,
                    recommendations: JSON.parse(JSON.stringify(recommendations.slice(0, 5))),
                    costChange,
                    messageChange,
                },
            });
            logger_1.default.info('Daily analysis generated', {
                accountId,
                date: periodStart.toISOString(),
                totalCost: costData.totalCost,
                optimizationScore,
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to generate daily analysis', { accountId, error });
            return false;
        }
    }
    /**
     * Generate monthly analysis
     */
    async generateMonthlyAnalysis(accountId, year, month) {
        try {
            const periodStart = new Date(year, month - 1, 1);
            const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
            // Get all daily analyses for the month
            const dailyAnalyses = await database_1.db.costAnalysis.findMany({
                where: {
                    accountId,
                    periodType: client_1.PeriodType.DAILY,
                    periodStart: {
                        gte: periodStart,
                        lte: periodEnd,
                    },
                },
            });
            if (dailyAnalyses.length === 0) {
                return false;
            }
            // Aggregate data
            const totalCost = dailyAnalyses.reduce((sum, a) => sum + a.totalCost, 0);
            const totalMessages = dailyAnalyses.reduce((sum, a) => sum + a.totalMessages, 0);
            const freeMessages = dailyAnalyses.reduce((sum, a) => sum + a.freeMessages, 0);
            const paidMessages = dailyAnalyses.reduce((sum, a) => sum + a.paidMessages, 0);
            const potentialSavings = dailyAnalyses.reduce((sum, a) => sum + a.potentialSavings, 0);
            const actualSavings = dailyAnalyses.reduce((sum, a) => sum + a.actualSavings, 0);
            // Average optimization score
            const avgOptimizationScore = Math.round(dailyAnalyses.reduce((sum, a) => sum + a.optimizationScore, 0) /
                dailyAnalyses.length);
            // Aggregate breakdown
            const breakdownMap = new Map();
            for (const analysis of dailyAnalyses) {
                const breakdown = analysis.breakdown;
                for (const item of breakdown) {
                    const existing = breakdownMap.get(item.category) || { count: 0, cost: 0 };
                    breakdownMap.set(item.category, {
                        count: existing.count + item.count,
                        cost: existing.cost + item.cost,
                    });
                }
            }
            const aggregatedBreakdown = Array.from(breakdownMap.entries()).map(([category, data]) => ({
                category,
                count: data.count,
                cost: data.cost,
                avgCostPerMessage: data.count > 0 ? data.cost / data.count : 0,
                percentage: totalMessages > 0 ? (data.count / totalMessages) * 100 : 0,
            }));
            // Get previous month for comparison
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            const previousAnalysis = await database_1.db.costAnalysis.findFirst({
                where: {
                    accountId,
                    periodType: client_1.PeriodType.MONTHLY,
                    periodStart: new Date(prevYear, prevMonth - 1, 1),
                },
            });
            const costChange = previousAnalysis ? totalCost - previousAnalysis.totalCost : null;
            const messageChange = previousAnalysis
                ? totalMessages - previousAnalysis.totalMessages
                : null;
            // Upsert monthly analysis
            await database_1.db.costAnalysis.upsert({
                where: {
                    accountId_periodStart_periodType: {
                        accountId,
                        periodStart,
                        periodType: client_1.PeriodType.MONTHLY,
                    },
                },
                create: {
                    accountId,
                    periodStart,
                    periodEnd,
                    periodType: client_1.PeriodType.MONTHLY,
                    totalMessages,
                    inboundMessages: dailyAnalyses.reduce((sum, a) => sum + a.inboundMessages, 0),
                    outboundMessages: dailyAnalyses.reduce((sum, a) => sum + a.outboundMessages, 0),
                    freeMessages,
                    paidMessages,
                    totalCost,
                    estimatedCost: totalCost,
                    potentialSavings,
                    actualSavings,
                    breakdown: aggregatedBreakdown,
                    optimizationScore: avgOptimizationScore,
                    recommendations: [],
                    costChange,
                    messageChange,
                },
                update: {
                    periodEnd,
                    totalMessages,
                    inboundMessages: dailyAnalyses.reduce((sum, a) => sum + a.inboundMessages, 0),
                    outboundMessages: dailyAnalyses.reduce((sum, a) => sum + a.outboundMessages, 0),
                    freeMessages,
                    paidMessages,
                    totalCost,
                    estimatedCost: totalCost,
                    potentialSavings,
                    actualSavings,
                    breakdown: aggregatedBreakdown,
                    optimizationScore: avgOptimizationScore,
                    costChange,
                    messageChange,
                },
            });
            logger_1.default.info('Monthly analysis generated', {
                accountId,
                month: `${year}-${month}`,
                totalCost,
                totalMessages,
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to generate monthly analysis', { accountId, error });
            return false;
        }
    }
    /**
     * Sync all active accounts
     */
    async syncAllAccounts() {
        const accounts = await database_1.db.account.findMany({
            where: { isActive: true },
            select: { id: true },
        });
        let success = 0;
        let failed = 0;
        for (const account of accounts) {
            const result = await this.syncAccount(account.id);
            if (result.success) {
                success++;
            }
            else {
                failed++;
            }
        }
        logger_1.default.info('All accounts sync completed', { success, failed });
        return { success, failed };
    }
    /**
     * Recalculate costs for historical messages
     */
    async recalculateCosts(accountId, startDate, endDate) {
        const messages = await database_1.db.message.findMany({
            where: {
                accountId,
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });
        let updated = 0;
        for (const message of messages) {
            // Reclassify
            const classification = this.classifier.classify({
                type: message.type,
                direction: message.direction,
                content: message.templateName || '',
                templateName: message.templateName || undefined,
                templateCategory: message.templateCategory || undefined,
                conversationAge: message.conversationExpiresAt
                    ? (new Date().getTime() - message.conversationExpiresAt.getTime()) / (1000 * 60 * 60) + 24
                    : undefined,
                isReply: message.direction === 'OUTBOUND',
            });
            // Recalculate cost
            const isFree = message.direction === 'INBOUND' ||
                message.isInFreeWindow ||
                classification.category === 'AUTHENTICATION';
            const cost = isFree
                ? 0
                : this.calculator.getMessageCost(classification.category);
            // Update if changed
            if (message.category !== classification.category ||
                message.cost !== cost) {
                await database_1.db.message.update({
                    where: { id: message.id },
                    data: {
                        category: classification.category,
                        cost,
                        classificationConfidence: classification.confidence,
                        classificationReason: classification.reasoning,
                    },
                });
                updated++;
            }
        }
        logger_1.default.info('Costs recalculated', { accountId, updated });
        return { updated };
    }
}
exports.MessageSyncService = MessageSyncService;
exports.default = MessageSyncService;
//# sourceMappingURL=messageSync.js.map