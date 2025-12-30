// =============================================================================
// MessageWise Optimizer - Email Service
// =============================================================================

import nodemailer, { Transporter } from 'nodemailer';
import logger from '../../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      logger.warn('Email service disabled: SMTP credentials not configured');
      this.isEnabled = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.isEnabled = true;
      logger.info('Email service initialized', { host: smtpHost });
    } catch (error) {
      logger.error('Failed to initialize email service', { error });
      this.isEnabled = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      logger.warn('Email not sent: service disabled', { to: options.to });
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'MessageWise <noreply@messagewise.io>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      logger.info('Email sent successfully', { to: options.to, subject: options.subject });
      return true;
    } catch (error) {
      logger.error('Failed to send email', { to: options.to, error });
      return false;
    }
  }

  // ==========================================================================
  // Email Templates
  // ==========================================================================

  /**
   * Welcome email for new users
   */
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const template = this.getWelcomeTemplate(name);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Password reset email
   */
  async sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
    const template = this.getPasswordResetTemplate(resetLink);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Daily summary email
   */
  async sendDailySummaryEmail(
    to: string,
    name: string,
    data: {
      totalMessages: number;
      totalCost: number;
      costBreakdown: { category: string; cost: number }[];
      savingsOpportunity: number;
    }
  ): Promise<boolean> {
    const template = this.getDailySummaryTemplate(name, data);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Cost alert email
   */
  async sendCostAlertEmail(
    to: string,
    name: string,
    data: {
      currentCost: number;
      threshold: number;
      percentageOver: number;
    }
  ): Promise<boolean> {
    const template = this.getCostAlertTemplate(name, data);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Payment confirmation email
   */
  async sendPaymentConfirmationEmail(
    to: string,
    name: string,
    data: {
      plan: string;
      amount: number;
      currency: string;
      invoiceNumber: string;
      periodEnd: Date;
    }
  ): Promise<boolean> {
    const template = this.getPaymentConfirmationTemplate(name, data);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Subscription expiring email
   */
  async sendSubscriptionExpiringEmail(
    to: string,
    name: string,
    data: {
      plan: string;
      expiresAt: Date;
      daysRemaining: number;
    }
  ): Promise<boolean> {
    const template = this.getSubscriptionExpiringTemplate(name, data);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  // ==========================================================================
  // Template Generators
  // ==========================================================================

  private getBaseStyles(): string {
    return `
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; }
      .content { padding: 30px; }
      .footer { background: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
      .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
      .btn:hover { background: #1d4ed8; }
      .stat-box { background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 10px 0; text-align: center; }
      .stat-value { font-size: 28px; font-weight: bold; color: #1f2937; }
      .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
      .alert-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0; }
      .success-box { background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 15px 0; }
    `;
  }

  private wrapInLayout(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${this.getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MessageWise</h1>
      <p style="margin: 5px 0 0; opacity: 0.9;">WhatsApp Business Cost Optimizer</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>MessageWise - Optimalkan Biaya WhatsApp Business API Anda</p>
      <p>
        <a href="https://messagewise.io" style="color: #2563eb;">Website</a> |
        <a href="https://messagewise.io/docs" style="color: #2563eb;">Dokumentasi</a> |
        <a href="mailto:support@messagewise.io" style="color: #2563eb;">Bantuan</a>
      </p>
      <p style="margin-top: 15px; font-size: 11px;">
        Anda menerima email ini karena terdaftar di MessageWise.<br>
        <a href="{unsubscribe_link}" style="color: #6b7280;">Berhenti berlangganan</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getWelcomeTemplate(name: string): EmailTemplate {
    const content = `
      <h2>Selamat Datang, ${name}!</h2>
      <p>Terima kasih telah bergabung dengan MessageWise. Kami siap membantu Anda mengoptimalkan biaya WhatsApp Business API.</p>

      <div class="success-box">
        <strong>Akun Anda sudah aktif!</strong>
        <p style="margin: 5px 0 0;">Anda dapat langsung mulai menggunakan MessageWise.</p>
      </div>

      <h3>Langkah Selanjutnya:</h3>
      <ol>
        <li><strong>Hubungkan Akun WhatsApp</strong> - Tambahkan nomor WhatsApp Business Anda</li>
        <li><strong>Lihat Analytics</strong> - Pantau penggunaan dan biaya pesan</li>
        <li><strong>Dapatkan Rekomendasi</strong> - Optimalkan pengeluaran Anda</li>
      </ol>

      <p style="text-align: center; margin-top: 30px;">
        <a href="https://messagewise.io/dashboard" class="btn">Buka Dashboard</a>
      </p>

      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        Ada pertanyaan? Balas email ini atau hubungi support@messagewise.io
      </p>
    `;

    return {
      subject: 'Selamat Datang di MessageWise!',
      html: this.wrapInLayout(content),
      text: `Selamat Datang, ${name}! Terima kasih telah bergabung dengan MessageWise. Akun Anda sudah aktif dan siap digunakan. Kunjungi https://messagewise.io/dashboard untuk memulai.`,
    };
  }

  private getPasswordResetTemplate(resetLink: string): EmailTemplate {
    const content = `
      <h2>Reset Password</h2>
      <p>Kami menerima permintaan untuk reset password akun MessageWise Anda.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="btn">Reset Password</a>
      </p>

      <p style="color: #6b7280; font-size: 14px;">
        Link ini akan kadaluarsa dalam 1 jam.<br>
        Jika Anda tidak meminta reset password, abaikan email ini.
      </p>

      <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
        Link: ${resetLink}
      </p>
    `;

    return {
      subject: 'Reset Password MessageWise',
      html: this.wrapInLayout(content),
      text: `Reset Password MessageWise. Klik link berikut untuk reset password: ${resetLink}. Link ini akan kadaluarsa dalam 1 jam.`,
    };
  }

  private getDailySummaryTemplate(
    name: string,
    data: {
      totalMessages: number;
      totalCost: number;
      costBreakdown: { category: string; cost: number }[];
      savingsOpportunity: number;
    }
  ): EmailTemplate {
    const formatIDR = (amount: number) =>
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    const breakdownHtml = data.costBreakdown
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatIDR(item.cost)}</td>
        </tr>
      `
      )
      .join('');

    const content = `
      <h2>Ringkasan Harian</h2>
      <p>Halo ${name}, berikut ringkasan aktivitas WhatsApp Anda hari ini:</p>

      <div style="display: flex; gap: 15px; margin: 20px 0;">
        <div class="stat-box" style="flex: 1;">
          <div class="stat-value">${data.totalMessages.toLocaleString('id-ID')}</div>
          <div class="stat-label">Total Pesan</div>
        </div>
        <div class="stat-box" style="flex: 1;">
          <div class="stat-value">${formatIDR(data.totalCost)}</div>
          <div class="stat-label">Total Biaya</div>
        </div>
      </div>

      <h3>Breakdown Biaya</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Kategori</th>
            <th style="padding: 8px; text-align: right;">Biaya</th>
          </tr>
        </thead>
        <tbody>
          ${breakdownHtml}
        </tbody>
      </table>

      ${
        data.savingsOpportunity > 0
          ? `
        <div class="alert-box" style="margin-top: 20px;">
          <strong>Potensi Penghematan: ${formatIDR(data.savingsOpportunity)}</strong>
          <p style="margin: 5px 0 0; font-size: 14px;">Lihat rekomendasi optimasi di dashboard Anda.</p>
        </div>
      `
          : ''
      }

      <p style="text-align: center; margin-top: 30px;">
        <a href="https://messagewise.io/dashboard/analytics" class="btn">Lihat Detail Analytics</a>
      </p>
    `;

    return {
      subject: `Ringkasan Harian - ${formatIDR(data.totalCost)} untuk ${data.totalMessages.toLocaleString('id-ID')} pesan`,
      html: this.wrapInLayout(content),
      text: `Ringkasan Harian. Total Pesan: ${data.totalMessages}. Total Biaya: ${formatIDR(data.totalCost)}. Lihat detail di dashboard.`,
    };
  }

  private getCostAlertTemplate(
    name: string,
    data: { currentCost: number; threshold: number; percentageOver: number }
  ): EmailTemplate {
    const formatIDR = (amount: number) =>
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    const content = `
      <h2 style="color: #dc2626;">Peringatan Biaya!</h2>
      <p>Halo ${name}, biaya WhatsApp Anda telah melebihi batas yang ditentukan.</p>

      <div class="alert-box" style="background: #fef2f2; border-color: #dc2626;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #dc2626;">Biaya Saat Ini</strong>
            <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${formatIDR(data.currentCost)}</div>
          </div>
          <div style="text-align: right;">
            <strong>Batas</strong>
            <div style="font-size: 18px;">${formatIDR(data.threshold)}</div>
          </div>
        </div>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #fca5a5;">
          <strong>${data.percentageOver.toFixed(0)}% di atas batas</strong>
        </div>
      </div>

      <h3>Tindakan yang Disarankan:</h3>
      <ul>
        <li>Tinjau kategori pesan yang paling banyak menghabiskan biaya</li>
        <li>Optimalkan penggunaan service window 24 jam</li>
        <li>Pertimbangkan untuk mengonversi pesan marketing ke utility</li>
      </ul>

      <p style="text-align: center; margin-top: 30px;">
        <a href="https://messagewise.io/dashboard/analytics" class="btn" style="background: #dc2626;">Lihat Analytics</a>
      </p>
    `;

    return {
      subject: `PERINGATAN: Biaya melebihi batas (${data.percentageOver.toFixed(0)}% over)`,
      html: this.wrapInLayout(content),
      text: `PERINGATAN: Biaya WhatsApp Anda (${formatIDR(data.currentCost)}) telah melebihi batas (${formatIDR(data.threshold)}) sebesar ${data.percentageOver.toFixed(0)}%.`,
    };
  }

  private getPaymentConfirmationTemplate(
    name: string,
    data: { plan: string; amount: number; currency: string; invoiceNumber: string; periodEnd: Date }
  ): EmailTemplate {
    const formatAmount = (amount: number, currency: string) => {
      if (currency === 'IDR') {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
      }
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const content = `
      <h2>Pembayaran Berhasil!</h2>
      <p>Halo ${name}, terima kasih atas pembayaran Anda.</p>

      <div class="success-box">
        <strong>Pembayaran telah dikonfirmasi</strong>
        <p style="margin: 5px 0 0;">Paket ${data.plan} Anda sekarang aktif.</p>
      </div>

      <h3>Detail Pembayaran</h3>
      <table style="width: 100%; margin: 15px 0;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Nomor Invoice</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: monospace;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Paket</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.plan}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Jumlah</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${formatAmount(data.amount, data.currency)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Berlaku Hingga</td>
          <td style="padding: 8px 0; text-align: right;">${data.periodEnd.toLocaleDateString('id-ID', { dateStyle: 'long' })}</td>
        </tr>
      </table>

      <p style="text-align: center; margin-top: 30px;">
        <a href="https://messagewise.io/dashboard/settings" class="btn">Lihat Langganan</a>
      </p>
    `;

    return {
      subject: `Pembayaran Berhasil - ${data.plan}`,
      html: this.wrapInLayout(content),
      text: `Pembayaran Berhasil! Paket ${data.plan} Anda sekarang aktif. Invoice: ${data.invoiceNumber}. Jumlah: ${formatAmount(data.amount, data.currency)}.`,
    };
  }

  private getSubscriptionExpiringTemplate(
    name: string,
    data: { plan: string; expiresAt: Date; daysRemaining: number }
  ): EmailTemplate {
    const content = `
      <h2>Langganan Akan Berakhir</h2>
      <p>Halo ${name}, langganan ${data.plan} Anda akan berakhir dalam ${data.daysRemaining} hari.</p>

      <div class="alert-box">
        <strong>Berakhir pada: ${data.expiresAt.toLocaleDateString('id-ID', { dateStyle: 'long' })}</strong>
        <p style="margin: 5px 0 0;">Perpanjang sekarang untuk tetap menikmati semua fitur.</p>
      </div>

      <h3>Apa yang Akan Anda Kehilangan:</h3>
      <ul>
        <li>Akses ke analytics lengkap</li>
        <li>Notifikasi Telegram</li>
        <li>Export laporan</li>
        <li>Rekomendasi AI</li>
      </ul>

      <p style="text-align: center; margin-top: 30px;">
        <a href="https://messagewise.io/dashboard/settings" class="btn">Perpanjang Sekarang</a>
      </p>

      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
        Jika Anda tidak memperpanjang, akun Anda akan otomatis downgrade ke paket Free.
      </p>
    `;

    return {
      subject: `Langganan ${data.plan} akan berakhir dalam ${data.daysRemaining} hari`,
      html: this.wrapInLayout(content),
      text: `Langganan ${data.plan} Anda akan berakhir dalam ${data.daysRemaining} hari (${data.expiresAt.toLocaleDateString('id-ID')}). Perpanjang di https://messagewise.io/dashboard/settings`,
    };
  }
}

export const emailService = new EmailService();
export default emailService;
