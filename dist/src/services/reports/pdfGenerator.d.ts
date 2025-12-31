import { CostReport } from '../../types';
interface PDFGeneratorOptions {
    includeRecommendations: boolean;
    includeMessageDetails: boolean;
    language: 'en' | 'id';
}
export declare class PDFGenerator {
    private doc;
    private options;
    private y;
    constructor(options?: Partial<PDFGeneratorOptions>);
    /**
     * Generate PDF report
     */
    generate(report: CostReport): Promise<Buffer>;
    /**
     * Add report header
     */
    private addHeader;
    /**
     * Add summary section
     */
    private addSummary;
    /**
     * Add summary box
     */
    private addSummaryBox;
    /**
     * Add category breakdown
     */
    private addCategoryBreakdown;
    /**
     * Add trends section
     */
    private addTrends;
    /**
     * Add trend item
     */
    private addTrendItem;
    /**
     * Add recommendations section
     */
    private addRecommendations;
    /**
     * Add daily breakdown
     */
    private addDailyBreakdown;
    /**
     * Add footer
     */
    private addFooter;
    /**
     * Add section title
     */
    private addSectionTitle;
    /**
     * Add divider line
     */
    private addDivider;
    /**
     * Check if page break is needed
     */
    private checkPageBreak;
    /**
     * Format date for display
     */
    private formatDate;
    /**
     * Get color for category
     */
    private getCategoryColor;
    /**
     * Format category name
     */
    private formatCategoryName;
    /**
     * Get color for score
     */
    private getScoreColor;
}
export default PDFGenerator;
//# sourceMappingURL=pdfGenerator.d.ts.map