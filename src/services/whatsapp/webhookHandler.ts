// =============================================================================
// MessageWise Optimizer - WhatsApp Webhook Handler
// =============================================================================

import { MessageType, MessageCategory, Direction, MessageStatus } from '@prisma/client';
import { db } from '../../config/database';
import { cacheGet, cacheSet, CacheKeys } from '../../config/redis';
import {
  WhatsAppWebhookPayload,
  WhatsAppIncomingMessage,
  WhatsAppMessageStatus,
  MessageData,
} from '../../types';
import { MessageClassifier } from '../analyzer/messageClassifier';
import { CostCalculator } from '../analyzer/costCalculator';
import { encrypt } from '../../utils/encryption';
import { fromUnixTimestamp, hoursAgo, hoursBetween } from '../../utils/helpers';
import logger from '../../utils/logger';

export class WhatsAppWebhookHandler {
  private classifier: MessageClassifier;
  private calculator: CostCalculator;

  constructor() {
    this.classifier = new MessageClassifier();
    this.calculator = new CostCalculator();
  }

  /**
   * Process incoming WhatsApp webhook payload
   */
  async processWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    const startTime = Date.now();

    try {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          const { value } = change;
          const phoneNumberId = value.metadata.phone_number_id;

          // Find the account for this phone number
          const account = await this.findAccountByPhoneNumberId(phoneNumberId);

          if (!account) {
            logger.warn('Webhook received for unknown phone number', { phoneNumberId });
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
      logger.debug('Webhook processed', { duration: `${duration}ms` });
    } catch (error) {
      logger.error('Webhook processing error', { error });
      throw error;
    }
  }

  /**
   * Process incoming messages
   */
  private async processMessages(
    accountId: string,
    messages: WhatsAppIncomingMessage[]
  ): Promise<void> {
    for (const msg of messages) {
      try {
        // Check for duplicate (idempotency)
        const exists = await this.checkDuplicate(msg.id);
        if (exists) {
          logger.debug('Duplicate message skipped', { messageId: msg.id });
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
          direction: Direction.INBOUND,
          content,
          isInbound: true,
          conversationAge: conversationInfo.ageHours,
        });

        // Create message record
        const messageData: MessageData = {
          waMessageId: msg.id,
          direction: Direction.INBOUND,
          type: messageType,
          category: classification.category,
          status: 'received',
          timestamp: fromUnixTimestamp(parseInt(msg.timestamp)),
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

        logger.debug('Inbound message processed', {
          messageId: msg.id,
          type: messageType,
          category: classification.category,
        });
      } catch (error) {
        logger.error('Error processing message', { messageId: msg.id, error });
      }
    }
  }

  /**
   * Process message status updates
   */
  private async processStatuses(
    accountId: string,
    statuses: WhatsAppMessageStatus[]
  ): Promise<void> {
    for (const status of statuses) {
      try {
        // Update message status
        const message = await db.message.findUnique({
          where: { waMessageId: status.id },
        });

        if (!message) {
          // This is an outbound message we haven't tracked yet
          // This can happen if message was sent outside our system
          await this.createOutboundMessage(accountId, status);
          continue;
        }

        // Update status
        await db.message.update({
          where: { id: message.id },
          data: {
            status: this.parseStatus(status.status),
          },
        });

        // If there's pricing info, update cost
        if (status.pricing) {
          const cost = status.pricing.billable
            ? this.calculator.getMessageCost(message.category as MessageCategory)
            : 0;

          await db.message.update({
            where: { id: message.id },
            data: { cost },
          });
        }

        // Update conversation info
        if (status.conversation) {
          await db.message.update({
            where: { id: message.id },
            data: {
              conversationId: status.conversation.id,
              conversationExpiresAt: status.conversation.expiration_timestamp
                ? new Date(parseInt(status.conversation.expiration_timestamp) * 1000)
                : undefined,
            },
          });
        }

        logger.debug('Message status updated', {
          messageId: status.id,
          status: status.status,
        });
      } catch (error) {
        logger.error('Error processing status', { statusId: status.id, error });
      }
    }
  }

  /**
   * Create outbound message from status update
   */
  private async createOutboundMessage(
    accountId: string,
    status: WhatsAppMessageStatus
  ): Promise<void> {
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
      let category: MessageCategory = MessageCategory.SERVICE;
      if (status.pricing?.category) {
        category = this.parsePricingCategory(status.pricing.category);
      }

      // Calculate cost
      const cost =
        status.pricing?.billable && !isInFreeWindow
          ? this.calculator.getMessageCost(category)
          : 0;

      // Create message record
      await db.message.create({
        data: {
          accountId,
          waMessageId: status.id,
          direction: Direction.OUTBOUND,
          type: MessageType.TEXT, // Default, we don't have type info from status
          category,
          status: this.parseStatus(status.status),
          timestamp: fromUnixTimestamp(parseInt(status.timestamp)),
          conversationId: conversationInfo.conversationId,
          conversationExpiresAt: conversationInfo.expiresAt,
          isInFreeWindow,
          cost,
          classificationConfidence: 0.7,
          classificationReason: 'Derived from status webhook',
        },
      });

      logger.debug('Outbound message created from status', {
        messageId: status.id,
        category,
        cost,
      });
    } catch (error) {
      logger.error('Error creating outbound message', { statusId: status.id, error });
    }
  }

  /**
   * Find account by phone number ID
   */
  private async findAccountByPhoneNumberId(phoneNumberId: string) {
    // Check cache first
    const cacheKey = `account:phone:${phoneNumberId}`;
    const cached = await cacheGet<{ id: string }>(cacheKey);

    if (cached) {
      return cached;
    }

    const account = await db.account.findFirst({
      where: {
        waPhoneNumberId: phoneNumberId,
        isActive: true,
      },
      select: { id: true },
    });

    if (account) {
      await cacheSet(cacheKey, account, 3600); // Cache for 1 hour
    }

    return account;
  }

  /**
   * Get or create conversation info
   */
  private async getConversationInfo(
    accountId: string,
    recipientId: string
  ): Promise<{
    conversationId: string;
    expiresAt: Date | undefined;
    ageHours: number;
  }> {
    // Look for recent conversation with this recipient
    const recentMessage = await db.message.findFirst({
      where: {
        accountId,
        direction: Direction.INBOUND,
        timestamp: { gte: hoursAgo(24) },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (recentMessage && recentMessage.conversationId) {
      const ageHours = hoursBetween(recentMessage.timestamp, new Date());
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
  private async checkDuplicate(messageId: string): Promise<boolean> {
    const cacheKey = CacheKeys.webhookDedup(messageId);
    const exists = await cacheGet(cacheKey);
    return exists !== null;
  }

  /**
   * Mark message as processed
   */
  private async markProcessed(messageId: string): Promise<void> {
    const cacheKey = CacheKeys.webhookDedup(messageId);
    await cacheSet(cacheKey, true, 86400); // 24 hours TTL
  }

  /**
   * Save message to database
   */
  private async saveMessage(accountId: string, data: MessageData): Promise<void> {
    await db.message.create({
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
        classificationConfidence: (data.metadata as Record<string, unknown>)?.classificationConfidence as number || 0,
        classificationReason: (data.metadata as Record<string, unknown>)?.classificationReason as string || '',
        metadata: data.metadata as object,
      },
    });
  }

  /**
   * Parse message type from WhatsApp webhook
   */
  private parseMessageType(type: string): MessageType {
    const typeMap: Record<string, MessageType> = {
      text: MessageType.TEXT,
      image: MessageType.IMAGE,
      video: MessageType.VIDEO,
      audio: MessageType.AUDIO,
      document: MessageType.DOCUMENT,
      sticker: MessageType.STICKER,
      location: MessageType.LOCATION,
      contacts: MessageType.CONTACTS,
      interactive: MessageType.INTERACTIVE,
      button: MessageType.INTERACTIVE,
      reaction: MessageType.REACTION,
    };

    return typeMap[type.toLowerCase()] || MessageType.UNKNOWN;
  }

  /**
   * Parse status string to MessageStatus enum
   */
  private parseStatus(status: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
      received: MessageStatus.DELIVERED,
    };

    return statusMap[status.toLowerCase()] || MessageStatus.PENDING;
  }

  /**
   * Parse pricing category to MessageCategory
   */
  private parsePricingCategory(category: string): MessageCategory {
    const categoryMap: Record<string, MessageCategory> = {
      authentication: MessageCategory.AUTHENTICATION,
      marketing: MessageCategory.MARKETING,
      utility: MessageCategory.UTILITY,
      service: MessageCategory.SERVICE,
    };

    return categoryMap[category.toLowerCase()] || MessageCategory.SERVICE;
  }

  /**
   * Extract message content for classification
   */
  private extractMessageContent(msg: WhatsAppIncomingMessage): string {
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
  static verifySignature(payload: string, signature: string, appSecret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }
}

export default WhatsAppWebhookHandler;
