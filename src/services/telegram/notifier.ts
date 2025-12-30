// =============================================================================
// MessageWise Optimizer - Telegram Notifier Service
// =============================================================================

import TelegramBot from 'node-telegram-bot-api';
import { db } from '../../config/database';
import { AlertData, DailySummaryData } from '../../types';
import { formatCurrency, round } from '../../utils/helpers';
import logger from '../../utils/logger';

export class TelegramNotifier {
  private bot: TelegramBot | null = null;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.ENABLE_TELEGRAM_ALERTS === 'true';

    if (this.isEnabled) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        logger.warn('TELEGRAM_BOT_TOKEN not configured, notifications disabled');
        this.isEnabled = false;
        return;
      }

      try {
        this.bot = new TelegramBot(token, { polling: false });
        logger.info('Telegram bot initialized');
      } catch (error) {
        logger.error('Failed to initialize Telegram bot', { error });
        this.isEnabled = false;
      }
    }
  }

  /**
   * Check if Telegram notifications are enabled
   */
  isActive(): boolean {
    return this.isEnabled && this.bot !== null;
  }

  /**
   * Send cost alert to user
   */
  async sendCostAlert(telegramId: string, data: AlertData): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const emoji = data.percentageChange > 20 ? '🚨' : '⚠️';
    const direction = data.percentageChange > 0 ? '📈' : '📉';

    const message = `
${emoji} *Cost Alert - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}

💰 *Current Cost:* ${formatCurrency(data.currentCost)}
📊 *Previous:* ${formatCurrency(data.previousCost)}
${direction} *Change:* ${data.percentageChange > 0 ? '+' : ''}${round(data.percentageChange, 1)}%

${data.percentageChange > data.threshold ? '⚠️ _Threshold exceeded!_' : ''}

${data.percentageChange > 30 ? '🚨 *Unusually high spending detected!*\nReview your message patterns immediately.' : 'Monitor your usage and apply optimizations.'}

[View Dashboard](https://messagewise.com/dashboard)
    `.trim();

    return this.sendMessage(telegramId, message);
  }

  /**
   * Send daily summary to user
   */
  async sendDailySummary(telegramId: string, data: DailySummaryData): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const scoreEmoji = data.optimizationScore >= 80 ? '🌟' : data.optimizationScore >= 60 ? '✅' : '⚠️';

    const message = `
📊 *Daily Summary - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}

💰 *Today's Cost:* ${formatCurrency(data.todayCost)}
📨 *Messages Sent:* ${data.messageCount.toLocaleString()}
💡 *Potential Savings:* ${formatCurrency(data.potentialSavings)}
${scoreEmoji} *Optimization Score:* ${data.optimizationScore}/100

${data.topRecommendation ? `🎯 *Top Tip:*\n_${this.escapeMarkdown(data.topRecommendation)}_` : ''}

[View Full Report](https://messagewise.com/dashboard/reports)
    `.trim();

    return this.sendMessage(telegramId, message);
  }

  /**
   * Send savings report
   */
  async sendSavingsReport(
    telegramId: string,
    data: {
      accountName: string;
      periodStart: Date;
      periodEnd: Date;
      actualSavings: number;
      optimizationScore: number;
      totalCost: number;
      potentialSavings: number;
    }
  ): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const savingsRate = data.potentialSavings > 0
      ? round((data.actualSavings / data.potentialSavings) * 100, 1)
      : 0;

    const message = `
✅ *Weekly Savings Report - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}
📅 *Period:* ${this.formatDate(data.periodStart)} - ${this.formatDate(data.periodEnd)}

💰 *Total Cost:* ${formatCurrency(data.totalCost)}
💵 *Actual Savings:* ${formatCurrency(data.actualSavings)}
🎯 *Savings Rate:* ${savingsRate}%
📊 *Optimization Score:* ${data.optimizationScore}/100

${data.actualSavings > 0 ? '🎉 Great work on optimizing your costs!' : '💡 Apply recommendations to start saving!'}

[View Detailed Report](https://messagewise.com/dashboard/reports)
    `.trim();

    return this.sendMessage(telegramId, message);
  }

  /**
   * Send budget warning
   */
  async sendBudgetWarning(
    telegramId: string,
    data: {
      accountName: string;
      currentSpend: number;
      budget: number;
      percentageUsed: number;
      daysRemaining: number;
    }
  ): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const emoji = data.percentageUsed >= 100 ? '🚨' : data.percentageUsed >= 90 ? '⚠️' : '📊';

    const message = `
${emoji} *Budget Alert - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}

💰 *Current Spend:* ${formatCurrency(data.currentSpend)}
📋 *Monthly Budget:* ${formatCurrency(data.budget)}
📊 *Used:* ${round(data.percentageUsed, 1)}%
📅 *Days Remaining:* ${data.daysRemaining}

${data.percentageUsed >= 100 ? '🚨 *Budget exceeded!* Review your messaging strategy immediately.' : data.percentageUsed >= 90 ? '⚠️ *Approaching budget limit.* Consider optimizing your messages.' : 'You\'re within budget. Keep monitoring.'}

[Manage Budget](https://messagewise.com/dashboard/settings)
    `.trim();

    return this.sendMessage(telegramId, message);
  }

  /**
   * Send recommendation notification
   */
  async sendRecommendation(
    telegramId: string,
    data: {
      accountName: string;
      title: string;
      description: string;
      potentialSavings: number;
      priority: string;
    }
  ): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
    }[data.priority] || '💡';

    const message = `
${priorityEmoji} *New Optimization Tip - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}

🎯 *${this.escapeMarkdown(data.title)}*

${this.escapeMarkdown(data.description)}

💰 *Potential Savings:* ${formatCurrency(data.potentialSavings)}

[Apply Recommendation](https://messagewise.com/dashboard/analytics)
    `.trim();

    return this.sendMessage(telegramId, message);
  }

  /**
   * Send welcome message when user connects Telegram
   */
  async sendWelcome(telegramId: string, userName: string): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const message = `
🎉 *Welcome to MessageWise!*

Hi ${this.escapeMarkdown(userName)}! Your Telegram account is now connected.

You'll receive:
• 📊 Daily cost summaries
• ⚠️ Cost spike alerts
• 💡 Optimization recommendations
• 💰 Savings reports

You can manage your notification preferences in the dashboard settings.

[Go to Dashboard](https://messagewise.com/dashboard)
    `.trim();

    return this.sendMessage(telegramId, message);
  }

  /**
   * Send account connected notification
   */
  async sendAccountConnected(
    telegramId: string,
    accountName: string,
    phoneNumber: string
  ): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const message = `
✅ *WhatsApp Account Connected*

📱 *Account:* ${this.escapeMarkdown(accountName)}
📞 *Phone:* ${this.escapeMarkdown(phoneNumber)}

Your account is now being monitored for cost optimization opportunities!

[View Account](https://messagewise.com/dashboard/accounts)
    `.trim();

    return this.sendMessage(telegramId, message);
  }

  /**
   * Core message sending method
   */
  private async sendMessage(chatId: string, message: string): Promise<boolean> {
    if (!this.bot) {
      return false;
    }

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      logger.debug('Telegram message sent', { chatId });
      return true;
    } catch (error) {
      logger.error('Failed to send Telegram message', { chatId, error });

      // Check if user blocked the bot
      if (
        error instanceof Error &&
        error.message.includes('bot was blocked by the user')
      ) {
        // Update user record to disable Telegram notifications
        await this.handleBlockedUser(chatId);
      }

      return false;
    }
  }

  /**
   * Handle blocked user
   */
  private async handleBlockedUser(telegramId: string): Promise<void> {
    try {
      await db.user.updateMany({
        where: { telegramId },
        data: { telegramNotifications: false },
      });

      logger.info('Disabled Telegram notifications for blocked user', { telegramId });
    } catch (error) {
      logger.error('Failed to update blocked user', { telegramId, error });
    }
  }

  /**
   * Escape Markdown special characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Generate Telegram link code for account connection
   */
  static generateLinkCode(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return Buffer.from(`${userId}:${timestamp}:${random}`).toString('base64');
  }

  /**
   * Verify link code
   */
  static verifyLinkCode(
    code: string,
    maxAgeMs: number = 3600000
  ): { userId: string; valid: boolean } {
    try {
      const decoded = Buffer.from(code, 'base64').toString();
      const [userId, timestampStr] = decoded.split(':');
      const timestamp = parseInt(timestampStr);

      if (Date.now() - timestamp > maxAgeMs) {
        return { userId: '', valid: false };
      }

      return { userId, valid: true };
    } catch {
      return { userId: '', valid: false };
    }
  }
}

export default TelegramNotifier;
