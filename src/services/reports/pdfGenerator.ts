// =============================================================================
// MessageWise Optimizer - PDF Report Generator
// =============================================================================

import PDFDocument from 'pdfkit';
import { CostReport, Recommendation } from '../../types';
import { formatCurrency, round } from '../../utils/helpers';
import logger from '../../utils/logger';

interface PDFGeneratorOptions {
  includeRecommendations: boolean;
  includeMessageDetails: boolean;
  language: 'en' | 'id';
}

const COLORS = {
  primary: '#2563EB',
  secondary: '#64748B',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#1F2937',
  lightText: '#6B7280',
  background: '#F9FAFB',
  white: '#FFFFFF',
};

export class PDFGenerator {
  private doc: typeof PDFDocument.prototype;
  private options: PDFGeneratorOptions;
  private y: number = 0;

  constructor(options: Partial<PDFGeneratorOptions> = {}) {
    this.options = {
      includeRecommendations: true,
      includeMessageDetails: false,
      language: 'en',
      ...options,
    };

    this.doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'MessageWise Cost Report',
        Author: 'MessageWise',
        Creator: 'MessageWise PDF Generator',
      },
    });
  }

  /**
   * Generate PDF report
   */
  async generate(report: CostReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];

        this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        this.doc.on('end', () => resolve(Buffer.concat(chunks)));
        this.doc.on('error', reject);

        // Generate content
        this.addHeader(report);
        this.addSummary(report);
        this.addCategoryBreakdown(report);
        this.addTrends(report);

        if (this.options.includeRecommendations && report.recommendations.length > 0) {
          this.addRecommendations(report.recommendations);
        }

        if (this.options.includeMessageDetails && report.dailyData.length > 0) {
          this.addDailyBreakdown(report);
        }

        this.addFooter();

        this.doc.end();
      } catch (error) {
        logger.error('PDF generation failed', { error });
        reject(error);
      }
    });
  }

  /**
   * Add report header
   */
  private addHeader(report: CostReport): void {
    // Logo placeholder
    this.doc
      .fontSize(24)
      .fillColor(COLORS.primary)
      .text('MessageWise', 50, 50)
      .fontSize(12)
      .fillColor(COLORS.secondary)
      .text('WhatsApp Cost Optimizer', 50, 78);

    // Report title
    this.doc
      .fontSize(18)
      .fillColor(COLORS.text)
      .text('Cost Analysis Report', 50, 120);

    // Report period
    this.doc
      .fontSize(10)
      .fillColor(COLORS.lightText)
      .text(
        `Period: ${this.formatDate(report.period.start)} - ${this.formatDate(report.period.end)}`,
        50,
        145
      );

    // Account info
    this.doc
      .fontSize(10)
      .text(`Account: ${report.account.name}`, 50, 160)
      .text(`Phone: ${report.account.phoneNumber}`, 50, 175);

    // Generated date
    this.doc
      .fontSize(9)
      .fillColor(COLORS.secondary)
      .text(`Generated: ${this.formatDate(report.generatedAt)}`, 400, 50, {
        align: 'right',
      });

    this.y = 200;
    this.addDivider();
  }

  /**
   * Add summary section
   */
  private addSummary(report: CostReport): void {
    this.addSectionTitle('Summary');

    const { summary } = report;
    const boxWidth = 120;
    const boxHeight = 60;
    const startX = 50;
    const gap = 15;

    // Summary boxes
    const summaryData = [
      {
        label: 'Total Cost',
        value: formatCurrency(summary.totalCost),
        color: COLORS.primary,
      },
      {
        label: 'Messages',
        value: summary.totalMessages.toLocaleString(),
        color: COLORS.secondary,
      },
      {
        label: 'Potential Savings',
        value: formatCurrency(summary.potentialSavings),
        color: COLORS.success,
      },
      {
        label: 'Optimization Score',
        value: `${summary.optimizationScore}/100`,
        color: this.getScoreColor(summary.optimizationScore),
      },
    ];

    summaryData.forEach((item, index) => {
      const x = startX + (boxWidth + gap) * index;
      this.addSummaryBox(x, this.y, boxWidth, boxHeight, item);
    });

    this.y += boxHeight + 30;

    // Additional stats
    this.doc
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(`Free Messages: ${summary.freeMessages.toLocaleString()}`, 50, this.y)
      .text(
        `Paid Messages: ${summary.paidMessages.toLocaleString()}`,
        200,
        this.y
      )
      .text(
        `Free Ratio: ${round((summary.freeMessages / summary.totalMessages) * 100, 1)}%`,
        350,
        this.y
      );

    this.y += 30;
    this.addDivider();
  }

  /**
   * Add summary box
   */
  private addSummaryBox(
    x: number,
    y: number,
    width: number,
    height: number,
    data: { label: string; value: string; color: string }
  ): void {
    // Box background
    this.doc
      .rect(x, y, width, height)
      .fillColor(COLORS.background)
      .fill();

    // Top border
    this.doc
      .rect(x, y, width, 3)
      .fillColor(data.color)
      .fill();

    // Label
    this.doc
      .fontSize(9)
      .fillColor(COLORS.lightText)
      .text(data.label, x + 10, y + 12, { width: width - 20 });

    // Value
    this.doc
      .fontSize(14)
      .fillColor(COLORS.text)
      .text(data.value, x + 10, y + 30, { width: width - 20 });
  }

  /**
   * Add category breakdown
   */
  private addCategoryBreakdown(report: CostReport): void {
    this.addSectionTitle('Cost Breakdown by Category');

    const { breakdown } = report;
    const tableTop = this.y;
    const colWidths = [150, 100, 100, 100];

    // Table header
    this.doc
      .fontSize(10)
      .fillColor(COLORS.text)
      .text('Category', 50, tableTop, { width: colWidths[0] })
      .text('Messages', 200, tableTop, { width: colWidths[1], align: 'right' })
      .text('Cost', 300, tableTop, { width: colWidths[2], align: 'right' })
      .text('% of Total', 400, tableTop, { width: colWidths[3], align: 'right' });

    this.y = tableTop + 20;

    // Divider
    this.doc
      .strokeColor(COLORS.secondary)
      .lineWidth(0.5)
      .moveTo(50, this.y)
      .lineTo(500, this.y)
      .stroke();

    this.y += 10;

    // Table rows
    breakdown.forEach((item) => {
      const categoryColor = this.getCategoryColor(item.category);

      // Category indicator
      this.doc
        .rect(50, this.y - 2, 4, 14)
        .fillColor(categoryColor)
        .fill();

      this.doc
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(this.formatCategoryName(item.category), 60, this.y, {
          width: colWidths[0] - 10,
        })
        .text(item.count.toLocaleString(), 200, this.y, {
          width: colWidths[1],
          align: 'right',
        })
        .text(formatCurrency(item.cost), 300, this.y, {
          width: colWidths[2],
          align: 'right',
        })
        .text(`${round(item.percentage, 1)}%`, 400, this.y, {
          width: colWidths[3],
          align: 'right',
        });

      this.y += 20;
    });

    this.y += 20;
    this.addDivider();
  }

  /**
   * Add trends section
   */
  private addTrends(report: CostReport): void {
    this.addSectionTitle('Trends vs Previous Period');

    const { trends } = report;
    const startX = 50;

    // Cost trend
    this.addTrendItem(startX, this.y, 'Cost', trends.cost);
    this.addTrendItem(startX + 180, this.y, 'Messages', trends.messages);
    this.addTrendItem(startX + 360, this.y, 'Savings', trends.savings);

    this.y += 50;
    this.addDivider();
  }

  /**
   * Add trend item
   */
  private addTrendItem(
    x: number,
    y: number,
    label: string,
    trend: { current: number; previous: number; changePercentage: number; trend: string }
  ): void {
    const arrow = trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→';
    const color =
      label === 'Savings'
        ? trend.trend === 'up'
          ? COLORS.success
          : COLORS.danger
        : trend.trend === 'up'
          ? COLORS.danger
          : COLORS.success;

    this.doc
      .fontSize(9)
      .fillColor(COLORS.lightText)
      .text(label, x, y);

    this.doc
      .fontSize(12)
      .fillColor(COLORS.text)
      .text(
        typeof trend.current === 'number' && trend.current > 1000
          ? trend.current.toLocaleString()
          : formatCurrency(trend.current),
        x,
        y + 15
      );

    this.doc
      .fontSize(10)
      .fillColor(color)
      .text(
        `${arrow} ${round(Math.abs(trend.changePercentage), 1)}%`,
        x,
        y + 32
      );
  }

  /**
   * Add recommendations section
   */
  private addRecommendations(recommendations: Recommendation[]): void {
    this.checkPageBreak(150);
    this.addSectionTitle('Optimization Recommendations');

    recommendations.slice(0, 5).forEach((rec, index) => {
      this.checkPageBreak(80);

      const priorityColor = {
        high: COLORS.danger,
        medium: COLORS.warning,
        low: COLORS.success,
      }[rec.priority];

      // Priority indicator
      this.doc
        .rect(50, this.y, 4, 40)
        .fillColor(priorityColor)
        .fill();

      // Title
      this.doc
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(`${index + 1}. ${rec.title}`, 60, this.y);

      // Description
      this.doc
        .fontSize(9)
        .fillColor(COLORS.lightText)
        .text(rec.description, 60, this.y + 15, {
          width: 400,
          lineGap: 2,
        });

      // Savings
      this.doc
        .fontSize(10)
        .fillColor(COLORS.success)
        .text(
          `Potential Savings: ${formatCurrency(rec.potentialSavings)}`,
          60,
          this.y + 40
        );

      this.y += 65;
    });

    this.addDivider();
  }

  /**
   * Add daily breakdown
   */
  private addDailyBreakdown(report: CostReport): void {
    this.checkPageBreak(200);
    this.addSectionTitle('Daily Breakdown');

    const tableTop = this.y;
    const colWidths = [80, 80, 80, 80, 80];

    // Header
    this.doc
      .fontSize(9)
      .fillColor(COLORS.text)
      .text('Date', 50, tableTop, { width: colWidths[0] })
      .text('Messages', 130, tableTop, { width: colWidths[1], align: 'right' })
      .text('Free', 210, tableTop, { width: colWidths[2], align: 'right' })
      .text('Paid', 290, tableTop, { width: colWidths[3], align: 'right' })
      .text('Cost', 370, tableTop, { width: colWidths[4], align: 'right' });

    this.y = tableTop + 15;

    this.doc
      .strokeColor(COLORS.secondary)
      .lineWidth(0.5)
      .moveTo(50, this.y)
      .lineTo(450, this.y)
      .stroke();

    this.y += 8;

    // Data rows (last 14 days max)
    report.dailyData.slice(-14).forEach((day) => {
      this.checkPageBreak(20);

      this.doc
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(this.formatDate(day.date), 50, this.y, { width: colWidths[0] })
        .text(day.totalMessages.toLocaleString(), 130, this.y, {
          width: colWidths[1],
          align: 'right',
        })
        .text(day.freeMessages.toLocaleString(), 210, this.y, {
          width: colWidths[2],
          align: 'right',
        })
        .text(day.paidMessages.toLocaleString(), 290, this.y, {
          width: colWidths[3],
          align: 'right',
        })
        .text(formatCurrency(day.totalCost), 370, this.y, {
          width: colWidths[4],
          align: 'right',
        });

      this.y += 18;
    });
  }

  /**
   * Add footer
   */
  private addFooter(): void {
    const pageCount = this.doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      this.doc.switchToPage(i);

      this.doc
        .fontSize(8)
        .fillColor(COLORS.lightText)
        .text(
          `Page ${i + 1} of ${pageCount}`,
          50,
          this.doc.page.height - 40,
          { align: 'center', width: this.doc.page.width - 100 }
        )
        .text(
          'Generated by MessageWise - messagewise.com',
          50,
          this.doc.page.height - 30,
          { align: 'center', width: this.doc.page.width - 100 }
        );
    }
  }

  /**
   * Add section title
   */
  private addSectionTitle(title: string): void {
    this.doc
      .fontSize(14)
      .fillColor(COLORS.text)
      .text(title, 50, this.y);

    this.y += 25;
  }

  /**
   * Add divider line
   */
  private addDivider(): void {
    this.doc
      .strokeColor(COLORS.background)
      .lineWidth(1)
      .moveTo(50, this.y)
      .lineTo(550, this.y)
      .stroke();

    this.y += 20;
  }

  /**
   * Check if page break is needed
   */
  private checkPageBreak(requiredSpace: number): void {
    if (this.y + requiredSpace > this.doc.page.height - 80) {
      this.doc.addPage();
      this.y = 50;
    }
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString(
      this.options.language === 'id' ? 'id-ID' : 'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );
  }

  /**
   * Get color for category
   */
  private getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      MARKETING: '#EF4444',
      UTILITY: '#3B82F6',
      AUTHENTICATION: '#22C55E',
      SERVICE: '#F59E0B',
    };
    return colors[category] || COLORS.secondary;
  }

  /**
   * Format category name
   */
  private formatCategoryName(category: string): string {
    return category.charAt(0) + category.slice(1).toLowerCase();
  }

  /**
   * Get color for score
   */
  private getScoreColor(score: number): string {
    if (score >= 80) return COLORS.success;
    if (score >= 60) return COLORS.warning;
    return COLORS.danger;
  }
}

export default PDFGenerator;
