"use strict";
// =============================================================================
// MessageWise Optimizer - Telegram Notifier Service
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramNotifier = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const database_1 = require("../../config/database");
const helpers_1 = require("../../utils/helpers");
const logger_1 = __importDefault(require("../../utils/logger"));
class TelegramNotifier {
    bot = null;
    isEnabled;
    constructor() {
        this.isEnabled = process.env.ENABLE_TELEGRAM_ALERTS === 'true';
        if (this.isEnabled) {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (!token) {
                logger_1.default.warn('TELEGRAM_BOT_TOKEN not configured, notifications disabled');
                this.isEnabled = false;
                return;
            }
            try {
                this.bot = new node_telegram_bot_api_1.default(token, { polling: false });
                logger_1.default.info('Telegram bot initialized');
            }
            catch (error) {
                logger_1.default.error('Failed to initialize Telegram bot', { error });
                this.isEnabled = false;
            }
        }
    }
    /**
     * Check if Telegram notifications are enabled
     */
    isActive() {
        return this.isEnabled && this.bot !== null;
    }
    /**
     * Send cost alert to user
     */
    async sendCostAlert(telegramId, data) {
        if (!this.isActive()) {
            return false;
        }
        const emoji = data.percentageChange > 20 ? '🚨' : '⚠️';
        const direction = data.percentageChange > 0 ? '📈' : '📉';
        const message = `
${emoji} *Cost Alert - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}

💰 *Current Cost:* ${(0, helpers_1.formatCurrency)(data.currentCost)}
📊 *Previous:* ${(0, helpers_1.formatCurrency)(data.previousCost)}
${direction} *Change:* ${data.percentageChange > 0 ? '+' : ''}${(0, helpers_1.round)(data.percentageChange, 1)}%

${data.percentageChange > data.threshold ? '⚠️ _Threshold exceeded!_' : ''}

${data.percentageChange > 30 ? '🚨 *Unusually high spending detected!*\nReview your message patterns immediately.' : 'Monitor your usage and apply optimizations.'}

[View Dashboard](https://messagewise.com/dashboard)
    `.trim();
        return this.sendMessage(telegramId, message);
    }
    /**
     * Send daily summary to user
     */
    async sendDailySummary(telegramId, data) {
        if (!this.isActive()) {
            return false;
        }
        const scoreEmoji = data.optimizationScore >= 80 ? '🌟' : data.optimizationScore >= 60 ? '✅' : '⚠️';
        const message = `
📊 *Daily Summary - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}

💰 *Today's Cost:* ${(0, helpers_1.formatCurrency)(data.todayCost)}
📨 *Messages Sent:* ${data.messageCount.toLocaleString()}
💡 *Potential Savings:* ${(0, helpers_1.formatCurrency)(data.potentialSavings)}
${scoreEmoji} *Optimization Score:* ${data.optimizationScore}/100

${data.topRecommendation ? `🎯 *Top Tip:*\n_${this.escapeMarkdown(data.topRecommendation)}_` : ''}

[View Full Report](https://messagewise.com/dashboard/reports)
    `.trim();
        return this.sendMessage(telegramId, message);
    }
    /**
     * Send savings report
     */
    async sendSavingsReport(telegramId, data) {
        if (!this.isActive()) {
            return false;
        }
        const savingsRate = data.potentialSavings > 0
            ? (0, helpers_1.round)((data.actualSavings / data.potentialSavings) * 100, 1)
            : 0;
        const message = `
✅ *Weekly Savings Report - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}
📅 *Period:* ${this.formatDate(data.periodStart)} - ${this.formatDate(data.periodEnd)}

💰 *Total Cost:* ${(0, helpers_1.formatCurrency)(data.totalCost)}
💵 *Actual Savings:* ${(0, helpers_1.formatCurrency)(data.actualSavings)}
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
    async sendBudgetWarning(telegramId, data) {
        if (!this.isActive()) {
            return false;
        }
        const emoji = data.percentageUsed >= 100 ? '🚨' : data.percentageUsed >= 90 ? '⚠️' : '📊';
        const message = `
${emoji} *Budget Alert - MessageWise*

📱 *Account:* ${this.escapeMarkdown(data.accountName)}

💰 *Current Spend:* ${(0, helpers_1.formatCurrency)(data.currentSpend)}
📋 *Monthly Budget:* ${(0, helpers_1.formatCurrency)(data.budget)}
📊 *Used:* ${(0, helpers_1.round)(data.percentageUsed, 1)}%
📅 *Days Remaining:* ${data.daysRemaining}

${data.percentageUsed >= 100 ? '🚨 *Budget exceeded!* Review your messaging strategy immediately.' : data.percentageUsed >= 90 ? '⚠️ *Approaching budget limit.* Consider optimizing your messages.' : 'You\'re within budget. Keep monitoring.'}

[Manage Budget](https://messagewise.com/dashboard/settings)
    `.trim();
        return this.sendMessage(telegramId, message);
    }
    /**
     * Send recommendation notification
     */
    async sendRecommendation(telegramId, data) {
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

💰 *Potential Savings:* ${(0, helpers_1.formatCurrency)(data.potentialSavings)}

[Apply Recommendation](https://messagewise.com/dashboard/analytics)
    `.trim();
        return this.sendMessage(telegramId, message);
    }
    /**
     * Send welcome message when user connects Telegram
     */
    async sendWelcome(telegramId, userName) {
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
    async sendAccountConnected(telegramId, accountName, phoneNumber) {
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
    async sendMessage(chatId, message) {
        if (!this.bot) {
            return false;
        }
        try {
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
            });
            logger_1.default.debug('Telegram message sent', { chatId });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to send Telegram message', { chatId, error });
            // Check if user blocked the bot
            if (error instanceof Error &&
                error.message.includes('bot was blocked by the user')) {
                // Update user record to disable Telegram notifications
                await this.handleBlockedUser(chatId);
            }
            return false;
        }
    }
    /**
     * Handle blocked user
     */
    async handleBlockedUser(telegramId) {
        try {
            await database_1.db.user.updateMany({
                where: { telegramId },
                data: { telegramNotifications: false },
            });
            logger_1.default.info('Disabled Telegram notifications for blocked user', { telegramId });
        }
        catch (error) {
            logger_1.default.error('Failed to update blocked user', { telegramId, error });
        }
    }
    /**
     * Escape Markdown special characters
     */
    escapeMarkdown(text) {
        return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    }
    /**
     * Format date for display
     */
    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }
    /**
     * Generate Telegram link code for account connection
     */
    static generateLinkCode(userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return Buffer.from(`${userId}:${timestamp}:${random}`).toString('base64');
    }
    /**
     * Verify link code
     */
    static verifyLinkCode(code, maxAgeMs = 3600000) {
        try {
            const decoded = Buffer.from(code, 'base64').toString();
            const [userId, timestampStr] = decoded.split(':');
            const timestamp = parseInt(timestampStr);
            if (Date.now() - timestamp > maxAgeMs) {
                return { userId: '', valid: false };
            }
            return { userId, valid: true };
        }
        catch {
            return { userId: '', valid: false };
        }
    }
}
exports.TelegramNotifier = TelegramNotifier;
exports.default = TelegramNotifier;
//# sourceMappingURL=notifier.js.map