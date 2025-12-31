"use strict";
// =============================================================================
// MessageWise Optimizer - WhatsApp API Client
// =============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const encryption_1 = require("../../utils/encryption");
const logger_1 = __importStar(require("../../utils/logger"));
const helpers_1 = require("../../utils/helpers");
class WhatsAppApiClient {
    client;
    phoneNumberId;
    accessToken;
    constructor(phoneNumberId, encryptedAccessToken) {
        this.phoneNumberId = phoneNumberId;
        this.accessToken = (0, encryption_1.decrypt)(encryptedAccessToken);
        const baseURL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
        this.client = axios_1.default.create({
            baseURL,
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        // Add response interceptor for logging
        this.client.interceptors.response.use((response) => {
            (0, logger_1.logApiCall)('WhatsApp', response.config.method?.toUpperCase() || 'GET', response.config.url || '', response.status);
            return response;
        }, (error) => {
            (0, logger_1.logApiCall)('WhatsApp', error.config?.method?.toUpperCase() || 'GET', error.config?.url || '', error.response?.status);
            throw error;
        });
    }
    /**
     * Send a text message
     */
    async sendTextMessage(to, text) {
        return this.sendMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
        });
    }
    /**
     * Send a template message
     */
    async sendTemplateMessage(to, templateName, languageCode = 'en', components) {
        return this.sendMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                components,
            },
        });
    }
    /**
     * Send an image message
     */
    async sendImageMessage(to, imageUrl, caption) {
        return this.sendMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: {
                link: imageUrl,
                caption,
            },
        });
    }
    /**
     * Send a document message
     */
    async sendDocumentMessage(to, documentUrl, filename, caption) {
        return this.sendMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'document',
            document: {
                link: documentUrl,
                filename,
                caption,
            },
        });
    }
    /**
     * Send an interactive message with buttons
     */
    async sendInteractiveButtons(to, bodyText, buttons) {
        return this.sendMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: bodyText },
                action: {
                    buttons: buttons.map((btn) => ({
                        type: 'reply',
                        reply: { id: btn.id, title: btn.title },
                    })),
                },
            },
        });
    }
    /**
     * Send an interactive list message
     */
    async sendInteractiveList(to, headerText, bodyText, buttonText, sections) {
        return this.sendMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: { type: 'text', text: headerText },
                body: { text: bodyText },
                action: {
                    button: buttonText,
                    sections,
                },
            },
        });
    }
    /**
     * Core send message method
     */
    async sendMessage(payload) {
        try {
            const response = await (0, helpers_1.retry)(async () => {
                const result = await this.client.post(`/${this.phoneNumberId}/messages`, payload);
                return result.data;
            }, 3, 1000);
            logger_1.default.debug('Message sent successfully', {
                messageId: response.messages[0]?.id,
            });
            return response;
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Get account information
     */
    async getAccountInfo() {
        try {
            const response = await this.client.get(`/${this.phoneNumberId}`);
            return response.data;
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Get conversation analytics
     */
    async getConversationAnalytics(startDate, endDate) {
        try {
            const response = await this.client.get(`/${this.phoneNumberId}/analytics`, {
                params: {
                    start: Math.floor(startDate.getTime() / 1000),
                    end: Math.floor(endDate.getTime() / 1000),
                    granularity: 'daily',
                    metric_types: 'cost,conversation',
                },
            });
            return response.data;
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Verify phone number status
     */
    async verifyPhoneNumber() {
        try {
            const response = await this.client.get(`/${this.phoneNumberId}`, {
                params: {
                    fields: 'verified_name,code_verification_status,quality_rating',
                },
            });
            return {
                verified: !!response.data.verified_name,
                codeVerificationStatus: response.data.code_verification_status || 'unknown',
                qualityRating: response.data.quality_rating || 'unknown',
            };
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Register webhook URL
     */
    async registerWebhook(webhookUrl) {
        try {
            await this.client.post(`/${this.phoneNumberId}/subscribed_apps`, {
                access_token: this.accessToken,
            });
            logger_1.default.info('Webhook registered successfully', { webhookUrl });
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Get message templates
     */
    async getTemplates(businessId) {
        try {
            const response = await this.client.get(`/${businessId}/message_templates`, {
                params: {
                    fields: 'name,category,language,status',
                },
            });
            return response.data.data || [];
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Mark message as read
     */
    async markAsRead(messageId) {
        try {
            await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            });
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Download media
     */
    async getMediaUrl(mediaId) {
        try {
            const response = await this.client.get(`/${mediaId}`);
            return response.data.url;
        }
        catch (error) {
            this.handleApiError(error);
            throw error;
        }
    }
    /**
     * Handle API errors
     */
    handleApiError(error) {
        const responseData = error.response?.data;
        logger_1.default.error('WhatsApp API error', {
            status: error.response?.status,
            code: responseData?.error?.code,
            message: responseData?.error?.message,
        });
        // Map common errors
        if (error.response?.status === 401) {
            throw new Error('WhatsApp API: Invalid or expired access token');
        }
        if (error.response?.status === 429) {
            throw new Error('WhatsApp API: Rate limit exceeded');
        }
        if (error.response?.status === 400) {
            const errorMessage = responseData?.error?.message || 'Bad request';
            throw new Error(`WhatsApp API: ${errorMessage}`);
        }
    }
}
exports.WhatsAppApiClient = WhatsAppApiClient;
exports.default = WhatsAppApiClient;
//# sourceMappingURL=apiClient.js.map