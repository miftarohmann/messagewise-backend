// =============================================================================
// MessageWise Optimizer - Message Classifier Service
// =============================================================================

import { MessageType, MessageCategory, Direction } from '@prisma/client';
import { CLASSIFICATION_KEYWORDS, WA_PRICING } from '../../config/constants';
import { ClassificationResult } from '../../types';
import logger from '../../utils/logger';

interface MessageInput {
  type: MessageType;
  direction: Direction;
  content?: string;
  templateName?: string;
  templateCategory?: string;
  conversationAge?: number; // hours since conversation started
  isReply?: boolean; // if this is a reply to customer message
  isInbound?: boolean; // if this is an inbound message
}

interface ClassificationWeights {
  keywordMatch: number;
  templateCategory: number;
  conversationContext: number;
  messageType: number;
}

const DEFAULT_WEIGHTS: ClassificationWeights = {
  keywordMatch: 0.4,
  templateCategory: 0.3,
  conversationContext: 0.2,
  messageType: 0.1,
};

export class MessageClassifier {
  private weights: ClassificationWeights;

  constructor(weights: ClassificationWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Classify a message into cost category using rule-based + keyword matching
   */
  classify(message: MessageInput): ClassificationResult {
    const startTime = Date.now();

    try {
      // Rule 1: Inbound messages are always SERVICE category (free)
      if (message.direction === Direction.INBOUND) {
        return {
          category: MessageCategory.SERVICE,
          confidence: 1.0,
          reasoning: 'Inbound messages are free and categorized as SERVICE',
        };
      }

      // Rule 2: Check template category if available (highest priority for templates)
      if (message.templateCategory) {
        const templateResult = this.classifyByTemplateCategory(message.templateCategory);
        if (templateResult) {
          return templateResult;
        }
      }

      // Rule 3: Check for authentication patterns
      if (this.isAuthenticationMessage(message)) {
        return {
          category: MessageCategory.AUTHENTICATION,
          confidence: 0.95,
          reasoning: 'Contains OTP/verification keywords or patterns',
        };
      }

      // Rule 4: Messages within 24h service window (if reply to customer)
      if (message.conversationAge !== undefined && message.conversationAge < 24 && message.isReply) {
        // Still classify the category, but mark as free window
        const keywordCategory = this.classifyByKeywords(message);
        return {
          category: keywordCategory.category,
          confidence: 0.9,
          reasoning: `Within 24-hour free service window. Category: ${keywordCategory.category}`,
        };
      }

      // Rule 5: Check marketing patterns
      if (this.isMarketingMessage(message)) {
        return {
          category: MessageCategory.MARKETING,
          confidence: this.calculateKeywordConfidence(message, 'MARKETING'),
          reasoning: 'Contains promotional/marketing keywords or patterns',
        };
      }

      // Rule 6: Check utility patterns
      if (this.isUtilityMessage(message)) {
        return {
          category: MessageCategory.UTILITY,
          confidence: this.calculateKeywordConfidence(message, 'UTILITY'),
          reasoning: 'Contains transactional/utility keywords',
        };
      }

      // Rule 7: Check service patterns
      if (this.isServiceMessage(message)) {
        return {
          category: MessageCategory.SERVICE,
          confidence: this.calculateKeywordConfidence(message, 'SERVICE'),
          reasoning: 'Contains customer service keywords',
        };
      }

      // Default: SERVICE with low confidence
      return {
        category: MessageCategory.SERVICE,
        confidence: 0.5,
        reasoning: 'Default classification - no strong pattern match',
      };
    } finally {
      const duration = Date.now() - startTime;
      logger.debug('Message classification completed', { duration: `${duration}ms` });
    }
  }

  /**
   * Batch classify multiple messages
   */
  classifyBatch(messages: MessageInput[]): ClassificationResult[] {
    return messages.map((msg) => this.classify(msg));
  }

  /**
   * Classify based on WhatsApp template category
   */
  private classifyByTemplateCategory(templateCategory: string): ClassificationResult | null {
    const categoryMap: Record<string, MessageCategory> = {
      AUTHENTICATION: MessageCategory.AUTHENTICATION,
      MARKETING: MessageCategory.MARKETING,
      UTILITY: MessageCategory.UTILITY,
      SERVICE: MessageCategory.SERVICE,
    };

    const upper = templateCategory.toUpperCase();
    if (categoryMap[upper]) {
      return {
        category: categoryMap[upper],
        confidence: 0.98,
        reasoning: `Template category: ${templateCategory}`,
      };
    }

    return null;
  }

  /**
   * Check if message is authentication-related
   */
  private isAuthenticationMessage(message: MessageInput): boolean {
    const content = this.getMessageContent(message).toLowerCase();

    // Check for OTP patterns (6-digit codes, verification codes)
    const otpPatterns = [
      /\b\d{4,8}\b.*?(code|kode|otp|verification|verifikasi)/i,
      /(code|kode|otp|verification|verifikasi).*?\b\d{4,8}\b/i,
      /your.*?code.*?is/i,
      /kode.*?anda/i,
    ];

    if (otpPatterns.some((pattern) => pattern.test(content))) {
      return true;
    }

    // Check for authentication keywords
    return this.hasKeywords(content, CLASSIFICATION_KEYWORDS.AUTHENTICATION, 2);
  }

  /**
   * Check if message is marketing-related
   */
  private isMarketingMessage(message: MessageInput): boolean {
    const content = this.getMessageContent(message).toLowerCase();

    // Check for marketing keywords
    if (this.hasKeywords(content, CLASSIFICATION_KEYWORDS.MARKETING, 2)) {
      return true;
    }

    // Check for marketing patterns
    const marketingPatterns = [
      /\d+%\s*(off|diskon|discount)/i,
      /(flash|super|mega)\s*sale/i,
      /limited\s*(time|offer|stock)/i,
      /buy\s*\d+\s*get\s*\d+/i,
      /free\s*shipping/i,
      /special.*?offer/i,
      /exclusive.*?deal/i,
    ];

    return marketingPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Check if message is utility-related (transactional)
   */
  private isUtilityMessage(message: MessageInput): boolean {
    const content = this.getMessageContent(message).toLowerCase();

    // Check for utility keywords
    if (this.hasKeywords(content, CLASSIFICATION_KEYWORDS.UTILITY, 2)) {
      return true;
    }

    // Check for utility patterns
    const utilityPatterns = [
      /order\s*#?\s*\w+/i,
      /invoice\s*#?\s*\w+/i,
      /receipt\s*#?\s*\w+/i,
      /tracking\s*#?\s*\w+/i,
      /booking\s*(id|number|confirmation)/i,
      /payment\s*(successful|received|confirmed)/i,
      /shipment\s*(update|status)/i,
      /delivery\s*(scheduled|completed)/i,
    ];

    return utilityPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Check if message is service-related (customer support)
   */
  private isServiceMessage(message: MessageInput): boolean {
    const content = this.getMessageContent(message).toLowerCase();

    // Check for service keywords
    return this.hasKeywords(content, CLASSIFICATION_KEYWORDS.SERVICE, 2);
  }

  /**
   * Get combined message content for analysis
   */
  private getMessageContent(message: MessageInput): string {
    const parts: string[] = [];

    if (message.content) {
      parts.push(message.content);
    }

    if (message.templateName) {
      parts.push(message.templateName);
    }

    return parts.join(' ');
  }

  /**
   * Check if content has minimum number of keywords from a list
   */
  private hasKeywords(content: string, keywords: readonly string[], minMatches: number): boolean {
    let matches = 0;

    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        matches++;
        if (matches >= minMatches) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate confidence based on keyword matches
   */
  private calculateKeywordConfidence(
    message: MessageInput,
    category: keyof typeof CLASSIFICATION_KEYWORDS
  ): number {
    const content = this.getMessageContent(message).toLowerCase();
    const keywords = CLASSIFICATION_KEYWORDS[category];

    let matches = 0;
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    // Base confidence + bonus for more matches (max 0.95)
    const baseConfidence = 0.7;
    const matchBonus = Math.min(matches * 0.05, 0.25);

    return Math.min(baseConfidence + matchBonus, 0.95);
  }

  /**
   * Classify by keywords with scores
   */
  private classifyByKeywords(message: MessageInput): ClassificationResult {
    const content = this.getMessageContent(message).toLowerCase();

    const scores: Record<MessageCategory, number> = {
      [MessageCategory.AUTHENTICATION]: 0,
      [MessageCategory.MARKETING]: 0,
      [MessageCategory.UTILITY]: 0,
      [MessageCategory.SERVICE]: 0,
    };

    // Score each category
    for (const keyword of CLASSIFICATION_KEYWORDS.AUTHENTICATION) {
      if (content.includes(keyword.toLowerCase())) {
        scores[MessageCategory.AUTHENTICATION] += 3; // Higher weight for auth
      }
    }

    for (const keyword of CLASSIFICATION_KEYWORDS.MARKETING) {
      if (content.includes(keyword.toLowerCase())) {
        scores[MessageCategory.MARKETING] += 1;
      }
    }

    for (const keyword of CLASSIFICATION_KEYWORDS.UTILITY) {
      if (content.includes(keyword.toLowerCase())) {
        scores[MessageCategory.UTILITY] += 1.5; // Medium weight
      }
    }

    for (const keyword of CLASSIFICATION_KEYWORDS.SERVICE) {
      if (content.includes(keyword.toLowerCase())) {
        scores[MessageCategory.SERVICE] += 1;
      }
    }

    // Find the highest scoring category
    let maxCategory: MessageCategory = MessageCategory.SERVICE;
    let maxScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category as MessageCategory;
      }
    }

    // Calculate confidence based on score differential
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.min(maxScore / totalScore + 0.3, 0.9) : 0.5;

    return {
      category: maxCategory,
      confidence,
      reasoning: `Keyword analysis: ${maxCategory} scored highest`,
    };
  }

  /**
   * Get estimated cost for a category
   */
  static getCategoryCost(category: MessageCategory, country: string = 'ID'): number {
    const rates = WA_PRICING.COUNTRY_RATES[country as keyof typeof WA_PRICING.COUNTRY_RATES]
      || WA_PRICING.CATEGORIES;

    switch (category) {
      case MessageCategory.AUTHENTICATION:
        return rates.AUTHENTICATION;
      case MessageCategory.MARKETING:
        return rates.MARKETING;
      case MessageCategory.UTILITY:
        return rates.UTILITY;
      case MessageCategory.SERVICE:
        return rates.SERVICE;
      default:
        return 0;
    }
  }

  /**
   * Get category display name
   */
  static getCategoryDisplayName(category: MessageCategory): string {
    const names: Record<MessageCategory, string> = {
      [MessageCategory.AUTHENTICATION]: 'Authentication',
      [MessageCategory.MARKETING]: 'Marketing',
      [MessageCategory.UTILITY]: 'Utility',
      [MessageCategory.SERVICE]: 'Service',
    };

    return names[category] || category;
  }
}

export default MessageClassifier;
