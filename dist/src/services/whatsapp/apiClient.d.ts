interface SendMessageResponse {
    messaging_product: string;
    contacts: Array<{
        wa_id: string;
    }>;
    messages: Array<{
        id: string;
    }>;
}
interface TemplateComponent {
    type: 'header' | 'body' | 'button';
    parameters: Array<{
        type: 'text' | 'image' | 'document' | 'video';
        text?: string;
        image?: {
            link: string;
        };
        document?: {
            link: string;
            filename: string;
        };
        video?: {
            link: string;
        };
    }>;
}
interface AccountInfo {
    id: string;
    phone_number: string;
    verified_name: string;
    quality_rating: string;
    messaging_limit_tier: string;
}
interface ConversationAnalytics {
    data: Array<{
        conversation_direction: string;
        conversation_type: string;
        cost: number;
    }>;
    paging: {
        cursors: {
            before: string;
            after: string;
        };
    };
}
export declare class WhatsAppApiClient {
    private client;
    private phoneNumberId;
    private accessToken;
    constructor(phoneNumberId: string, encryptedAccessToken: string);
    /**
     * Send a text message
     */
    sendTextMessage(to: string, text: string): Promise<SendMessageResponse>;
    /**
     * Send a template message
     */
    sendTemplateMessage(to: string, templateName: string, languageCode?: string, components?: TemplateComponent[]): Promise<SendMessageResponse>;
    /**
     * Send an image message
     */
    sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<SendMessageResponse>;
    /**
     * Send a document message
     */
    sendDocumentMessage(to: string, documentUrl: string, filename: string, caption?: string): Promise<SendMessageResponse>;
    /**
     * Send an interactive message with buttons
     */
    sendInteractiveButtons(to: string, bodyText: string, buttons: Array<{
        id: string;
        title: string;
    }>): Promise<SendMessageResponse>;
    /**
     * Send an interactive list message
     */
    sendInteractiveList(to: string, headerText: string, bodyText: string, buttonText: string, sections: Array<{
        title: string;
        rows: Array<{
            id: string;
            title: string;
            description?: string;
        }>;
    }>): Promise<SendMessageResponse>;
    /**
     * Core send message method
     */
    private sendMessage;
    /**
     * Get account information
     */
    getAccountInfo(): Promise<AccountInfo>;
    /**
     * Get conversation analytics
     */
    getConversationAnalytics(startDate: Date, endDate: Date): Promise<ConversationAnalytics>;
    /**
     * Verify phone number status
     */
    verifyPhoneNumber(): Promise<{
        verified: boolean;
        codeVerificationStatus: string;
        qualityRating: string;
    }>;
    /**
     * Register webhook URL
     */
    registerWebhook(webhookUrl: string): Promise<void>;
    /**
     * Get message templates
     */
    getTemplates(businessId: string): Promise<Array<{
        name: string;
        category: string;
        language: string;
        status: string;
    }>>;
    /**
     * Mark message as read
     */
    markAsRead(messageId: string): Promise<void>;
    /**
     * Download media
     */
    getMediaUrl(mediaId: string): Promise<string>;
    /**
     * Handle API errors
     */
    private handleApiError;
}
export default WhatsAppApiClient;
//# sourceMappingURL=apiClient.d.ts.map