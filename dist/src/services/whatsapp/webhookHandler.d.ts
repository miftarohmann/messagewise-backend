import { WhatsAppWebhookPayload } from '../../types';
export declare class WhatsAppWebhookHandler {
    private classifier;
    private calculator;
    constructor();
    /**
     * Process incoming WhatsApp webhook payload
     */
    processWebhook(payload: WhatsAppWebhookPayload): Promise<void>;
    /**
     * Process incoming messages
     */
    private processMessages;
    /**
     * Process message status updates
     */
    private processStatuses;
    /**
     * Create outbound message from status update
     */
    private createOutboundMessage;
    /**
     * Find account by phone number ID
     */
    private findAccountByPhoneNumberId;
    /**
     * Get or create conversation info
     */
    private getConversationInfo;
    /**
     * Check if message was already processed
     */
    private checkDuplicate;
    /**
     * Mark message as processed
     */
    private markProcessed;
    /**
     * Save message to database
     */
    private saveMessage;
    /**
     * Parse message type from WhatsApp webhook
     */
    private parseMessageType;
    /**
     * Parse status string to MessageStatus enum
     */
    private parseStatus;
    /**
     * Parse pricing category to MessageCategory
     */
    private parsePricingCategory;
    /**
     * Extract message content for classification
     */
    private extractMessageContent;
    /**
     * Verify webhook signature
     */
    static verifySignature(payload: string, signature: string, appSecret: string): boolean;
}
export default WhatsAppWebhookHandler;
//# sourceMappingURL=webhookHandler.d.ts.map