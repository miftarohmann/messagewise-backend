"use strict";
// =============================================================================
// MessageWise Optimizer - WhatsApp Webhook Handler
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppWebhookHandler = void 0;
const client_1 = require("@prisma/client");
const database_1 = require("../../config/database");
const redis_1 = require("../../config/redis");
const messageClassifier_1 = require("../analyzer/messageClassifier");
const costCalculator_1 = require("../analyzer/costCalculator");
const helpers_1 = require("../../utils/helpers");
const logger_1 = __importDefault(require("../../utils/logger"));
class WhatsAppWebhookHandler {
    classifier;
    calculator;
    constructor() {
        this.classifier = new messageClassifier_1.MessageClassifier();
        this.calculator = new costCalculator_1.CostCalculator();
    }
    /**
     * Process incoming WhatsApp webhook payload
     */
    async processWebhook(payload) {
        const startTime = Date.now();
        try {
            for (const entry of payload.entry) {
                for (const change of entry.changes) {
                    const { value } = change;
                    const phoneNumberId = value.metadata.phone_number_id;
                    // Find the account for this phone number
                    const account = await this.findAccountByPhoneNumberId(phoneNumberId);
                    if (!account) {
                        logger_1.default.warn('Webhook received for unknown phone number', { phoneNumberId });
                        continue;
                    }
                    // Process messages
                    if (value.messages && value.messages.length > 0) {
                        await this.processMessages(account.id, value.messages);
                    }
                    // Process status updates
                    if (value.statuses && value.statuses.length > 0) {
                        await this.processStatuses(account.id, value.statuses);
                    }
                }
            }
            const duration = Date.now() - startTime;
            logger_1.default.debug('Webhook processed', { duration: `${duration}ms` });
        }
        catch (error) {
            logger_1.default.error('Webhook processing error', { error });
            throw error;
        }
    }
    /**
     * Process incoming messages
     */
    async processMessages(accountId, messages) {
        for (const msg of messages) {
            try {
                // Check for duplicate (idempotency)
                const exists = await this.checkDuplicate(msg.id);
                if (exists) {
                    logger_1.default.debug('Duplicate message skipped', { messageId: msg.id });
                    continue;
                }
                // Get conversation info
                const conversationInfo = await this.getConversationInfo(accountId, msg.from);
                // Parse message type
                const messageType = this.parseMessageType(msg.type);
                // Get message content for classification
                const content = this.extractMessageContent(msg);
                // Classify the message
                const classification = this.classifier.classify({
                    type: messageType,
                    direction: client_1.Direction.INBOUND,
                    content,
                    isInbound: true,
                    conversationAge: conversationInfo.ageHours,
                });
                // Create message record
                const messageData = {
                    waMessageId: msg.id,
                    direction: client_1.Direction.INBOUND,
                    type: messageType,
                    category: classification.category,
                    status: 'received',
                    timestamp: (0, helpers_1.fromUnixTimestamp)(parseInt(msg.timestamp)),
                    conversationId: conversationInfo.conversationId,
                    conversationExpiresAt: conversationInfo.expiresAt,
                    isInFreeWindow: true, // Inbound is always free
                    cost: 0,
                    metadata: {
                        from: msg.from,
                        contactName: msg.from,
                        classificationConfidence: classification.confidence,
                        classificationReason: classification.reasoning,
                    },
                };
                await this.saveMessage(accountId, messageData);
                // Mark as processed (for deduplication)
                await this.markProcessed(msg.id);
                logger_1.default.debug('Inbound message processed', {
                    messageId: msg.id,
                    type: messageType,
                    category: classification.category,
                });
            }
            catch (error) {
                logger_1.default.error('Error processing message', { messageId: msg.id, error });
            }
        }
    }
    /**
     * Process message status updates
     */
    async processStatuses(accountId, statuses) {
        for (const status of statuses) {
            try {
                // Update message status
                const message = await database_1.db.message.findUnique({
                    where: { waMessageId: status.id },
                });
                if (!message) {
                    // This is an outbound message we haven't tracked yet
                    // This can happen if message was sent outside our system
                    await this.createOutboundMessage(accountId, status);
                    continue;
                }
                // Update status
                await database_1.db.message.update({
                    where: { id: message.id },
                    data: {
                        status: this.parseStatus(status.status),
                    },
                });
                // If there's pricing info, update cost
                if (status.pricing) {
                    const cost = status.pricing.billable
                        ? this.calculator.getMessageCost(message.category)
                        : 0;
                    await database_1.db.message.update({
                        where: { id: message.id },
                        data: { cost },
                    });
                }
                // Update conversation info
                if (status.conversation) {
                    await database_1.db.message.update({
                        where: { id: message.id },
                        data: {
                            conversationId: status.conversation.id,
                            conversationExpiresAt: status.conversation.expiration_timestamp
                                ? new Date(parseInt(status.conversation.expiration_timestamp) * 1000)
                                : undefined,
                        },
                    });
                }
                logger_1.default.debug('Message status updated', {
                    messageId: status.id,
                    status: status.status,
                });
            }
            catch (error) {
                logger_1.default.error('Error processing status', { statusId: status.id, error });
            }
        }
    }
    /**
     * Create outbound message from status update
     */
    async createOutboundMessage(accountId, status) {
        try {
            // Determine if in free window
            const conversationInfo = status.conversation
                ? {
                    conversationId: status.conversation.id,
                    expiresAt: status.conversation.expiration_timestamp
                        ? new Date(parseInt(status.conversation.expiration_timestamp) * 1000)
                        : undefined,
                    ageHours: 0,
                }
                : await this.getConversationInfo(accountId, status.recipient_id);
            const isInFreeWindow = conversationInfo.ageHours < 24;
            // Determine category from pricing info
            let category = client_1.MessageCategory.SERVICE;
            if (status.pricing?.category) {
                category = this.parsePricingCategory(status.pricing.category);
            }
            // Calculate cost
            const cost = status.pricing?.billable && !isInFreeWindow
                ? this.calculator.getMessageCost(category)
                : 0;
            // Create message record
            await database_1.db.message.create({
                data: {
                    accountId,
                    waMessageId: status.id,
                    direction: client_1.Direction.OUTBOUND,
                    type: client_1.MessageType.TEXT, // Default, we don't have type info from status
                    category,
                    status: this.parseStatus(status.status),
                    timestamp: (0, helpers_1.fromUnixTimestamp)(parseInt(status.timestamp)),
                    conversationId: conversationInfo.conversationId,
                    conversationExpiresAt: conversationInfo.expiresAt,
                    isInFreeWindow,
                    cost,
                    classificationConfidence: 0.7,
                    classificationReason: 'Derived from status webhook',
                },
            });
            logger_1.default.debug('Outbound message created from status', {
                messageId: status.id,
                category,
                cost,
            });
        }
        catch (error) {
            logger_1.default.error('Error creating outbound message', { statusId: status.id, error });
        }
    }
    /**
     * Find account by phone number ID
     */
    async findAccountByPhoneNumberId(phoneNumberId) {
        // Check cache first
        const cacheKey = `account:phone:${phoneNumberId}`;
        const cached = await (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            return cached;
        }
        const account = await database_1.db.account.findFirst({
            where: {
                waPhoneNumberId: phoneNumberId,
                isActive: true,
            },
            select: { id: true },
        });
        if (account) {
            await (0, redis_1.cacheSet)(cacheKey, account, 3600); // Cache for 1 hour
        }
        return account;
    }
    /**
     * Get or create conversation info
     */
    async getConversationInfo(accountId, recipientId) {
        // Look for recent conversation with this recipient
        const recentMessage = await database_1.db.message.findFirst({
            where: {
                accountId,
                direction: client_1.Direction.INBOUND,
                timestamp: { gte: (0, helpers_1.hoursAgo)(24) },
            },
            orderBy: { timestamp: 'desc' },
        });
        if (recentMessage && recentMessage.conversationId) {
            const ageHours = (0, helpers_1.hoursBetween)(recentMessage.timestamp, new Date());
            return {
                conversationId: recentMessage.conversationId,
                expiresAt: recentMessage.conversationExpiresAt || undefined,
                ageHours,
            };
        }
        // No recent conversation, create new one
        return {
            conversationId: `conv_${Date.now()}_${recipientId}`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            ageHours: 0,
        };
    }
    /**
     * Check if message was already processed
     */
    async checkDuplicate(messageId) {
        const cacheKey = redis_1.CacheKeys.webhookDedup(messageId);
        const exists = await (0, redis_1.cacheGet)(cacheKey);
        return exists !== null;
    }
    /**
     * Mark message as processed
     */
    async markProcessed(messageId) {
        const cacheKey = redis_1.CacheKeys.webhookDedup(messageId);
        await (0, redis_1.cacheSet)(cacheKey, true, 86400); // 24 hours TTL
    }
    /**
     * Save message to database
     */
    async saveMessage(accountId, data) {
        await database_1.db.message.create({
            data: {
                accountId,
                waMessageId: data.waMessageId,
                direction: data.direction,
                type: data.type,
                category: data.category,
                status: this.parseStatus(data.status),
                timestamp: data.timestamp,
                conversationId: data.conversationId,
                conversationExpiresAt: data.conversationExpiresAt,
                isInFreeWindow: data.isInFreeWindow,
                cost: data.cost,
                templateName: data.templateName,
                templateCategory: data.templateCategory,
                classificationConfidence: data.metadata?.classificationConfidence || 0,
                classificationReason: data.metadata?.classificationReason || '',
                metadata: data.metadata,
            },
        });
    }
    /**
     * Parse message type from WhatsApp webhook
     */
    parseMessageType(type) {
        const typeMap = {
            text: client_1.MessageType.TEXT,
            image: client_1.MessageType.IMAGE,
            video: client_1.MessageType.VIDEO,
            audio: client_1.MessageType.AUDIO,
            document: client_1.MessageType.DOCUMENT,
            sticker: client_1.MessageType.STICKER,
            location: client_1.MessageType.LOCATION,
            contacts: client_1.MessageType.CONTACTS,
            interactive: client_1.MessageType.INTERACTIVE,
            button: client_1.MessageType.INTERACTIVE,
            reaction: client_1.MessageType.REACTION,
        };
        return typeMap[type.toLowerCase()] || client_1.MessageType.UNKNOWN;
    }
    /**
     * Parse status string to MessageStatus enum
     */
    parseStatus(status) {
        const statusMap = {
            sent: client_1.MessageStatus.SENT,
            delivered: client_1.MessageStatus.DELIVERED,
            read: client_1.MessageStatus.READ,
            failed: client_1.MessageStatus.FAILED,
            received: client_1.MessageStatus.DELIVERED,
        };
        return statusMap[status.toLowerCase()] || client_1.MessageStatus.PENDING;
    }
    /**
     * Parse pricing category to MessageCategory
     */
    parsePricingCategory(category) {
        const categoryMap = {
            authentication: client_1.MessageCategory.AUTHENTICATION,
            marketing: client_1.MessageCategory.MARKETING,
            utility: client_1.MessageCategory.UTILITY,
            service: client_1.MessageCategory.SERVICE,
        };
        return categoryMap[category.toLowerCase()] || client_1.MessageCategory.SERVICE;
    }
    /**
     * Extract message content for classification
     */
    extractMessageContent(msg) {
        if (msg.text?.body) {
            return msg.text.body;
        }
        if (msg.interactive) {
            return msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || '';
        }
        return '';
    }
    /**
     * Verify webhook signature
     */
    static verifySignature(payload, signature, appSecret) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', appSecret)
            .update(payload)
            .digest('hex');
        return `sha256=${expectedSignature}` === signature;
    }
}
exports.WhatsAppWebhookHandler = WhatsAppWebhookHandler;
exports.default = WhatsAppWebhookHandler;
//# sourceMappingURL=webhookHandler.js.map