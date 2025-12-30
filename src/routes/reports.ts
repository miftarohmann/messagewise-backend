// =============================================================================
// MessageWise Optimizer - Report Routes
// =============================================================================

import { Router, Response } from 'express';
import { db } from '../config/database';
import { AuthenticatedRequest, CostReport } from '../types';
import { authenticate, requirePlan } from '../middleware/auth';
import { validate, reportValidation } from '../middleware/validator';
import { reportRateLimiter } from '../middleware/rateLimiter';
import { CostCalculator } from '../services/analyzer/costCalculator';
import { CostOptimizer } from '../services/analyzer/optimizer';
import { PDFGenerator } from '../services/reports/pdfGenerator';
import { startOfDay, endOfDay, daysAgo, round } from '../utils/helpers';
import { ERROR_CODES, PRICING } from '../config/constants';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/reports/generate
 * Generate a cost report
 */
router.post(
  '/generate',
  authenticate,
  requirePlan('STARTER', 'PRO', 'ENTERPRISE'),
  reportRateLimiter,
  validate(reportValidation.generate),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        accountId,
        startDate,
        endDate,
        format = 'json',
        includeRecommendations = true,
        includeMessageDetails = false,
      } = req.body;

      // Verify access
      const account = await db.account.findFirst({
        where: {
          id: accountId,
          userId: req.user!.userId,
        },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Account not found',
          },
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get messages for the period
      const messages = await db.message.findMany({
        where: {
          accountId,
          timestamp: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Calculate costs
      const calculator = new CostCalculator();
      const breakdown = calculator.calculateCost(
        messages.map((m) => ({
          category: m.category,
          isInFreeWindow: m.isInFreeWindow,
          direction: m.direction,
          timestamp: m.timestamp,
          conversationId: m.conversationId || undefined,
        }))
      );

      // Get daily costs
      const dailyCosts = calculator.calculateDailyCosts(
        messages.map((m) => ({
          category: m.category,
          isInFreeWindow: m.isInFreeWindow,
          direction: m.direction,
          timestamp: m.timestamp,
          conversationId: m.conversationId || undefined,
        }))
      );

      // Generate recommendations
      const optimizer = new CostOptimizer();
      const recommendations = includeRecommendations
        ? optimizer.generateRecommendations(
            messages.map((m) => ({
              id: m.id,
              category: m.category,
              isInFreeWindow: m.isInFreeWindow,
              direction: m.direction,
              timestamp: m.timestamp,
              conversationId: m.conversationId || undefined,
              cost: m.cost,
            })),
            {
              totalCost: breakdown.totalCost,
              totalMessages: breakdown.messageCount,
              freeMessages: breakdown.freeMessages,
              paidMessages: breakdown.paidMessages,
              breakdown: breakdown.breakdown.map((b) => ({
                category: b.category,
                count: b.count,
                cost: b.cost,
              })),
            }
          )
        : [];

      const optimizationScore = optimizer.calculateOptimizationScore(
        messages.map((m) => ({
          id: m.id,
          category: m.category,
          isInFreeWindow: m.isInFreeWindow,
          direction: m.direction,
          timestamp: m.timestamp,
          conversationId: m.conversationId || undefined,
          cost: m.cost,
        })),
        {
          totalCost: breakdown.totalCost,
          totalMessages: breakdown.messageCount,
          freeMessages: breakdown.freeMessages,
          paidMessages: breakdown.paidMessages,
          breakdown: breakdown.breakdown.map((b) => ({
            category: b.category,
            count: b.count,
            cost: b.cost,
          })),
        }
      );

      // Get previous period for trends
      const periodLength = end.getTime() - start.getTime();
      const previousStart = new Date(start.getTime() - periodLength);
      const previousEnd = new Date(start.getTime() - 1);

      const previousMessages = await db.message.findMany({
        where: {
          accountId,
          timestamp: {
            gte: previousStart,
            lte: previousEnd,
          },
        },
      });

      const previousBreakdown = calculator.calculateCost(
        previousMessages.map((m) => ({
          category: m.category,
          isInFreeWindow: m.isInFreeWindow,
          direction: m.direction,
          timestamp: m.timestamp,
          conversationId: m.conversationId || undefined,
        }))
      );

      // Calculate trends
      const costChange = previousBreakdown.totalCost > 0
        ? breakdown.totalCost - previousBreakdown.totalCost
        : breakdown.totalCost;
      const costChangePercentage = previousBreakdown.totalCost > 0
        ? ((breakdown.totalCost - previousBreakdown.totalCost) / previousBreakdown.totalCost) * 100
        : 0;

      const messageChange = previousBreakdown.messageCount > 0
        ? breakdown.messageCount - previousBreakdown.messageCount
        : breakdown.messageCount;
      const messageChangePercentage = previousBreakdown.messageCount > 0
        ? ((breakdown.messageCount - previousBreakdown.messageCount) / previousBreakdown.messageCount) * 100
        : 0;

      // Build report
      const report: CostReport = {
        generatedAt: new Date(),
        period: { start, end },
        account: {
          id: account.id,
          name: account.accountName,
          phoneNumber: account.waPhoneNumber,
        },
        summary: {
          totalCost: breakdown.totalCost,
          totalMessages: breakdown.messageCount,
          freeMessages: breakdown.freeMessages,
          paidMessages: breakdown.paidMessages,
          potentialSavings: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0),
          actualSavings: 0, // Would be calculated from implemented recommendations
          optimizationScore,
        },
        breakdown: breakdown.breakdown,
        dailyData: Array.from(dailyCosts.entries()).map(([date, cost]) => ({
          date: new Date(date),
          totalCost: cost.totalCost,
          totalMessages: cost.messageCount,
          breakdown: cost.breakdown,
          freeMessages: cost.freeMessages,
          paidMessages: cost.paidMessages,
        })),
        recommendations,
        trends: {
          cost: {
            current: breakdown.totalCost,
            previous: previousBreakdown.totalCost,
            change: costChange,
            changePercentage: round(costChangePercentage, 1),
            trend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'stable',
          },
          messages: {
            current: breakdown.messageCount,
            previous: previousBreakdown.messageCount,
            change: messageChange,
            changePercentage: round(messageChangePercentage, 1),
            trend: messageChange > 0 ? 'up' : messageChange < 0 ? 'down' : 'stable',
          },
          savings: {
            current: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0),
            previous: 0,
            change: 0,
            changePercentage: 0,
            trend: 'stable',
          },
        },
      };

      // Return based on format
      if (format === 'pdf') {
        const pdfGenerator = new PDFGenerator({
          includeRecommendations,
          includeMessageDetails,
        });

        const pdfBuffer = await pdfGenerator.generate(report);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="messagewise-report-${start.toISOString().split('T')[0]}.pdf"`
        );
        res.send(pdfBuffer);
        return;
      }

      if (format === 'csv') {
        const csvLines = [
          'Date,Messages,Free,Paid,Cost,Marketing,Utility,Authentication,Service',
          ...report.dailyData.map((day) => {
            const marketing = day.breakdown.find((b) => b.category === 'MARKETING')?.count || 0;
            const utility = day.breakdown.find((b) => b.category === 'UTILITY')?.count || 0;
            const auth = day.breakdown.find((b) => b.category === 'AUTHENTICATION')?.count || 0;
            const service = day.breakdown.find((b) => b.category === 'SERVICE')?.count || 0;

            return `${day.date.toISOString().split('T')[0]},${day.totalMessages},${day.freeMessages},${day.paidMessages},${day.totalCost},${marketing},${utility},${auth},${service}`;
          }),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="messagewise-report-${start.toISOString().split('T')[0]}.csv"`
        );
        res.send(csvLines);
        return;
      }

      // Default: JSON
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Generate report failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to generate report',
        },
      });
    }
  }
);

/**
 * GET /api/reports/history
 * Get report generation history
 */
router.get(
  '/history',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get all analyses as report history
      const analyses = await db.costAnalysis.findMany({
        where: {
          account: { userId: req.user!.userId },
          periodType: 'MONTHLY',
        },
        include: {
          account: {
            select: { accountName: true },
          },
        },
        orderBy: { periodStart: 'desc' },
        take: 12,
      });

      const history = analyses.map((a) => ({
        id: a.id,
        accountName: a.account.accountName,
        periodStart: a.periodStart,
        periodEnd: a.periodEnd,
        totalCost: a.totalCost,
        totalMessages: a.totalMessages,
        optimizationScore: a.optimizationScore,
        createdAt: a.createdAt,
      }));

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Get report history failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to get report history',
        },
      });
    }
  }
);

/**
 * GET /api/reports/quick-summary
 * Get quick summary for all accounts
 */
router.get(
  '/quick-summary',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all accounts with their latest analysis
      const accounts = await db.account.findMany({
        where: { userId: req.user!.userId },
        include: {
          analyses: {
            where: {
              periodStart: { gte: startOfMonth },
            },
            orderBy: { periodStart: 'desc' },
            take: 1,
          },
        },
      });

      const summary = {
        totalCost: 0,
        totalMessages: 0,
        totalPotentialSavings: 0,
        avgOptimizationScore: 0,
        accounts: accounts.map((acc) => {
          const analysis = acc.analyses[0];
          const cost = analysis?.totalCost || 0;
          const messages = analysis?.totalMessages || 0;
          const savings = analysis?.potentialSavings || 0;
          const score = analysis?.optimizationScore || 0;

          return {
            id: acc.id,
            name: acc.accountName,
            cost,
            messages,
            potentialSavings: savings,
            optimizationScore: score,
          };
        }),
      };

      // Calculate totals
      summary.totalCost = summary.accounts.reduce((sum, a) => sum + a.cost, 0);
      summary.totalMessages = summary.accounts.reduce((sum, a) => sum + a.messages, 0);
      summary.totalPotentialSavings = summary.accounts.reduce((sum, a) => sum + a.potentialSavings, 0);
      summary.avgOptimizationScore = summary.accounts.length > 0
        ? Math.round(summary.accounts.reduce((sum, a) => sum + a.optimizationScore, 0) / summary.accounts.length)
        : 0;

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Get quick summary failed', { error });
      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to get quick summary',
        },
      });
    }
  }
);

export default router;
