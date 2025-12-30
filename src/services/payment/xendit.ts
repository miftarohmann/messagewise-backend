// =============================================================================
// MessageWise Optimizer - Xendit Payment Integration (Indonesian Payments)
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import { Plan, InvoiceStatus, PaymentGateway, Currency } from '@prisma/client';
import { db } from '../../config/database';
import { PRICING } from '../../config/constants';
import { generateSecureToken } from '../../utils/encryption';
import logger from '../../utils/logger';

interface XenditInvoice {
  id: string;
  external_id: string;
  user_id: string;
  status: string;
  amount: number;
  payer_email: string;
  description: string;
  invoice_url: string;
  expiry_date: string;
  created: string;
  updated: string;
  paid_at?: string;
  paid_amount?: number;
  payment_method?: string;
  payment_channel?: string;
}

interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  currency?: string;
}

export class XenditService {
  private client: AxiosInstance;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.ENABLE_XENDIT === 'true';

    const secretKey = process.env.XENDIT_SECRET_KEY || '';

    this.client = axios.create({
      baseURL: 'https://api.xendit.co',
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: secretKey,
        password: '',
      },
    });
  }

  /**
   * Check if Xendit is enabled
   */
  isActive(): boolean {
    return this.isEnabled;
  }

  /**
   * Create an invoice for subscription
   */
  async createInvoice(
    userId: string,
    email: string,
    plan: Plan,
    successUrl: string,
    failureUrl: string
  ): Promise<{ invoiceUrl: string; invoiceId: string }> {
    if (!this.isActive()) {
      throw new Error('Xendit payments are not enabled');
    }

    if (plan === Plan.FREE) {
      throw new Error('Cannot create invoice for free plan');
    }

    const pricing = PRICING[plan];
    const externalId = `mw_${userId}_${plan}_${Date.now()}`;

    try {
      const response = await this.client.post<XenditInvoice>('/v2/invoices', {
        external_id: externalId,
        amount: pricing.priceIDR,
        currency: 'IDR',
        payer_email: email,
        description: `MessageWise ${pricing.name} Plan - Monthly Subscription`,
        success_redirect_url: successUrl,
        failure_redirect_url: failureUrl,
        invoice_duration: 86400, // 24 hours
        customer: {
          email,
        },
        items: [
          {
            name: `${pricing.name} Plan`,
            quantity: 1,
            price: pricing.priceIDR,
          },
        ],
        fees: [],
        payment_methods: [
          'CREDIT_CARD',
          'BCA',
          'BNI',
          'BRI',
          'MANDIRI',
          'PERMATA',
          'ALFAMART',
          'INDOMARET',
          'OVO',
          'DANA',
          'LINKAJA',
          'SHOPEEPAY',
          'QRIS',
        ],
      });

      // Store invoice in database
      await db.invoice.create({
        data: {
          userId,
          invoiceNumber: externalId,
          amount: pricing.priceIDR,
          currency: Currency.IDR,
          status: InvoiceStatus.PENDING,
          gateway: PaymentGateway.XENDIT,
          gatewayId: response.data.id,
          gatewayData: JSON.parse(JSON.stringify(response.data)),
          plan,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          dueDate: new Date(response.data.expiry_date),
        },
      });

      logger.info('Xendit invoice created', {
        invoiceId: response.data.id,
        userId,
        plan,
      });

      return {
        invoiceUrl: response.data.invoice_url,
        invoiceId: response.data.id,
      };
    } catch (error) {
      logger.error('Failed to create Xendit invoice', { userId, plan, error });
      throw error;
    }
  }

  /**
   * Get invoice status
   */
  async getInvoice(invoiceId: string): Promise<XenditInvoice | null> {
    if (!this.isActive()) {
      return null;
    }

    try {
      const response = await this.client.get<XenditInvoice>(`/v2/invoices/${invoiceId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Xendit invoice', { invoiceId, error });
      return null;
    }
  }

  /**
   * Expire an invoice
   */
  async expireInvoice(invoiceId: string): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    try {
      await this.client.post(`/invoices/${invoiceId}/expire!`);
      logger.info('Xendit invoice expired', { invoiceId });
      return true;
    } catch (error) {
      logger.error('Failed to expire Xendit invoice', { invoiceId, error });
      return false;
    }
  }

  /**
   * Handle Xendit webhook callback
   */
  async handleWebhook(
    payload: XenditInvoice,
    callbackToken: string
  ): Promise<{ success: boolean; message: string }> {
    // Verify webhook token
    const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN || '';
    if (callbackToken !== expectedToken) {
      logger.warn('Invalid Xendit webhook token');
      return { success: false, message: 'Invalid token' };
    }

    try {
      const invoice = await db.invoice.findFirst({
        where: { gatewayId: payload.id },
      });

      if (!invoice) {
        logger.warn('Invoice not found for webhook', { invoiceId: payload.id });
        return { success: false, message: 'Invoice not found' };
      }

      switch (payload.status) {
        case 'PAID':
        case 'SETTLED':
          await this.handlePaymentSuccess(invoice.id, invoice.userId, invoice.plan, payload);
          break;

        case 'EXPIRED':
          await this.handlePaymentExpired(invoice.id);
          break;

        case 'FAILED':
          await this.handlePaymentFailed(invoice.id);
          break;

        default:
          logger.debug('Unhandled Xendit status', { status: payload.status });
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      logger.error('Xendit webhook processing failed', { error });
      return { success: false, message: 'Processing failed' };
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(
    invoiceId: string,
    userId: string,
    plan: Plan,
    payload: XenditInvoice
  ): Promise<void> {
    // Update invoice status
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: payload.paid_at ? new Date(payload.paid_at) : new Date(),
        gatewayData: JSON.parse(JSON.stringify(payload)),
      },
    });

    // Update user plan
    await db.user.update({
      where: { id: userId },
      data: {
        plan,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    logger.info('Xendit payment successful', { userId, plan, invoiceId });
  }

  /**
   * Handle expired payment
   */
  private async handlePaymentExpired(invoiceId: string): Promise<void> {
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.CANCELLED },
    });

    logger.info('Xendit invoice expired', { invoiceId });
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(invoiceId: string): Promise<void> {
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.FAILED },
    });

    logger.info('Xendit payment failed', { invoiceId });
  }

  /**
   * Create recurring payment (subscription simulation)
   */
  async createRecurringPayment(
    userId: string,
    email: string,
    plan: Plan
  ): Promise<void> {
    // Xendit doesn't have native subscriptions like Stripe
    // We handle this by creating invoices monthly via a cron job
    // This is a placeholder for the recurring payment setup

    logger.info('Recurring payment setup', { userId, plan });

    // Store subscription preference
    // The actual invoice creation will be handled by a scheduled job
  }

  /**
   * Get available payment methods for Indonesia
   */
  static getAvailablePaymentMethods(): Array<{
    code: string;
    name: string;
    type: string;
  }> {
    return [
      // Bank Transfer
      { code: 'BCA', name: 'Bank Central Asia', type: 'bank_transfer' },
      { code: 'BNI', name: 'Bank Negara Indonesia', type: 'bank_transfer' },
      { code: 'BRI', name: 'Bank Rakyat Indonesia', type: 'bank_transfer' },
      { code: 'MANDIRI', name: 'Bank Mandiri', type: 'bank_transfer' },
      { code: 'PERMATA', name: 'Bank Permata', type: 'bank_transfer' },

      // E-Wallets
      { code: 'OVO', name: 'OVO', type: 'ewallet' },
      { code: 'DANA', name: 'DANA', type: 'ewallet' },
      { code: 'LINKAJA', name: 'LinkAja', type: 'ewallet' },
      { code: 'SHOPEEPAY', name: 'ShopeePay', type: 'ewallet' },

      // Retail
      { code: 'ALFAMART', name: 'Alfamart', type: 'retail' },
      { code: 'INDOMARET', name: 'Indomaret', type: 'retail' },

      // QR
      { code: 'QRIS', name: 'QRIS', type: 'qr' },

      // Cards
      { code: 'CREDIT_CARD', name: 'Credit/Debit Card', type: 'card' },
    ];
  }

  /**
   * Format IDR amount for display
   */
  static formatIDR(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

export default XenditService;
