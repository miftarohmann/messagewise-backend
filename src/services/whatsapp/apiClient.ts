// =============================================================================
// MessageWise Optimizer - WhatsApp API Client
// =============================================================================

import axios, { AxiosInstance, AxiosError } from 'axios';
import { MessageType } from '@prisma/client';
import { decrypt } from '../../utils/encryption';
import logger, { logApiCall } from '../../utils/logger';
import { retry } from '../../utils/helpers';

interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{ wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: { link: string };
    document?: { link: string; filename: string };
    video?: { link: string };
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

export class WhatsAppApiClient {
  private client: AxiosInstance;
  private phoneNumberId: string;
  private accessToken: string;

  constructor(phoneNumberId: string, encryptedAccessToken: string) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = decrypt(encryptedAccessToken);

    const baseURL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logApiCall(
          'WhatsApp',
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status
        );
        return response;
      },
      (error: AxiosError) => {
        logApiCall(
          'WhatsApp',
          error.config?.method?.toUpperCase() || 'GET',
          error.config?.url || '',
          error.response?.status
        );
        throw error;
      }
    );
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, text: string): Promise<SendMessageResponse> {
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
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components?: TemplateComponent[]
  ): Promise<SendMessageResponse> {
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
  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<SendMessageResponse> {
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
  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string
  ): Promise<SendMessageResponse> {
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
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<SendMessageResponse> {
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
  async sendInteractiveList(
    to: string,
    headerText: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<SendMessageResponse> {
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
  private async sendMessage(payload: object): Promise<SendMessageResponse> {
    try {
      const response = await retry(
        async () => {
          const result = await this.client.post<SendMessageResponse>(
            `/${this.phoneNumberId}/messages`,
            payload
          );
          return result.data;
        },
        3,
        1000
      );

      logger.debug('Message sent successfully', {
        messageId: response.messages[0]?.id,
      });

      return response;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const response = await this.client.get<AccountInfo>(`/${this.phoneNumberId}`);
      return response.data;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<ConversationAnalytics> {
    try {
      const response = await this.client.get<ConversationAnalytics>(
        `/${this.phoneNumberId}/analytics`,
        {
          params: {
            start: Math.floor(startDate.getTime() / 1000),
            end: Math.floor(endDate.getTime() / 1000),
            granularity: 'daily',
            metric_types: 'cost,conversation',
          },
        }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Verify phone number status
   */
  async verifyPhoneNumber(): Promise<{
    verified: boolean;
    codeVerificationStatus: string;
    qualityRating: string;
  }> {
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
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Register webhook URL
   */
  async registerWebhook(webhookUrl: string): Promise<void> {
    try {
      await this.client.post(`/${this.phoneNumberId}/subscribed_apps`, {
        access_token: this.accessToken,
      });

      logger.info('Webhook registered successfully', { webhookUrl });
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Get message templates
   */
  async getTemplates(businessId: string): Promise<Array<{
    name: string;
    category: string;
    language: string;
    status: string;
  }>> {
    try {
      const response = await this.client.get(`/${businessId}/message_templates`, {
        params: {
          fields: 'name,category,language,status',
        },
      });

      return response.data.data || [];
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Download media
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await this.client.get(`/${mediaId}`);
      return response.data.url;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: AxiosError): void {
    const responseData = error.response?.data as Record<string, unknown>;

    logger.error('WhatsApp API error', {
      status: error.response?.status,
      code: (responseData?.error as Record<string, unknown>)?.code,
      message: (responseData?.error as Record<string, unknown>)?.message,
    });

    // Map common errors
    if (error.response?.status === 401) {
      throw new Error('WhatsApp API: Invalid or expired access token');
    }

    if (error.response?.status === 429) {
      throw new Error('WhatsApp API: Rate limit exceeded');
    }

    if (error.response?.status === 400) {
      const errorMessage = (responseData?.error as Record<string, unknown>)?.message || 'Bad request';
      throw new Error(`WhatsApp API: ${errorMessage}`);
    }
  }
}

export default WhatsAppApiClient;
