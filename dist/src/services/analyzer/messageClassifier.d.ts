import { MessageType, MessageCategory, Direction } from '@prisma/client';
import { ClassificationResult } from '../../types';
interface MessageInput {
    type: MessageType;
    direction: Direction;
    content?: string;
    templateName?: string;
    templateCategory?: string;
    conversationAge?: number;
    isReply?: boolean;
    isInbound?: boolean;
}
interface ClassificationWeights {
    keywordMatch: number;
    templateCategory: number;
    conversationContext: number;
    messageType: number;
}
export declare class MessageClassifier {
    private weights;
    constructor(weights?: ClassificationWeights);
    /**
     * Classify a message into cost category using rule-based + keyword matching
     */
    classify(message: MessageInput): ClassificationResult;
    /**
     * Batch classify multiple messages
     */
    classifyBatch(messages: MessageInput[]): ClassificationResult[];
    /**
     * Classify based on WhatsApp template category
     */
    private classifyByTemplateCategory;
    /**
     * Check if message is authentication-related
     */
    private isAuthenticationMessage;
    /**
     * Check if message is marketing-related
     */
    private isMarketingMessage;
    /**
     * Check if message is utility-related (transactional)
     */
    private isUtilityMessage;
    /**
     * Check if message is service-related (customer support)
     */
    private isServiceMessage;
    /**
     * Get combined message content for analysis
     */
    private getMessageContent;
    /**
     * Check if content has minimum number of keywords from a list
     */
    private hasKeywords;
    /**
     * Calculate confidence based on keyword matches
     */
    private calculateKeywordConfidence;
    /**
     * Classify by keywords with scores
     */
    private classifyByKeywords;
    /**
     * Get estimated cost for a category
     */
    static getCategoryCost(category: MessageCategory, country?: string): number;
    /**
     * Get category display name
     */
    static getCategoryDisplayName(category: MessageCategory): string;
}
export default MessageClassifier;
//# sourceMappingURL=messageClassifier.d.ts.map