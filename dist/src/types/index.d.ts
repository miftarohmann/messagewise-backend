import { Request } from 'express';
import { Plan, Currency, MessageCategory, MessageType, Direction } from '@prisma/client';
export interface JWTPayload {
    userId: string;
    email: string;
    plan: Plan;
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user?: JWTPayload;
    apiKey?: ApiKeyPayload;
}
export interface ApiKeyPayload {
    keyId: string;
    userId: string;
    permissions: string[];
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface CreateUserInput {
    email: string;
    password: string;
    name?: string;
}
export interface UpdateUserInput {
    name?: string;
    timezone?: string;
    currency?: Currency;
    language?: string;
    emailNotifications?: boolean;
    telegramNotifications?: boolean;
    dailySummary?: boolean;
    costAlertThreshold?: number;
}
export interface UserResponse {
    id: string;
    email: string;
    name: string | null;
    plan: Plan;
    planExpiresAt: Date | null;
    timezone: string;
    currency: Currency;
    language: string;
    telegramConnected: boolean;
    createdAt: Date;
}
export interface CreateAccountInput {
    waBusinessId: string;
    waPhoneNumberId: string;
    waAccessToken: string;
    waPhoneNumber: string;
    accountName: string;
    monthlyBudget?: number;
}
export interface UpdateAccountInput {
    accountName?: string;
    monthlyBudget?: number;
    alertThreshold?: number;
    isActive?: boolean;
}
export interface AccountResponse {
    id: string;
    waBusinessId: string;
    waPhoneNumber: string;
    accountName: string;
    isActive: boolean;
    isVerified: boolean;
    lastSyncAt: Date | null;
    monthlyBudget: number | null;
    createdAt: Date;
}
export interface MessageData {
    waMessageId: string;
    direction: Direction;
    type: MessageType;
    category: MessageCategory;
    status: string;
    timestamp: Date;
    conversationId?: string;
    conversationExpiresAt?: Date;
    isInFreeWindow: boolean;
    cost: number;
    templateName?: string;
    templateCategory?: string;
    content?: string;
    metadata?: Record<string, unknown>;
}
export interface ClassificationResult {
    category: MessageCategory;
    confidence: number;
    reasoning: string;
}
export interface MessageFilters {
    accountId?: string;
    startDate?: Date;
    endDate?: Date;
    category?: MessageCategory;
    direction?: Direction;
    type?: MessageType;
    isInFreeWindow?: boolean;
}
export interface CostBreakdown {
    totalCost: number;
    messageCount: number;
    breakdown: CategoryBreakdown[];
    freeMessages: number;
    paidMessages: number;
    currency: Currency;
}
export interface CategoryBreakdown {
    category: MessageCategory;
    count: number;
    cost: number;
    avgCostPerMessage: number;
    percentage: number;
}
export interface AnalyticsSummary {
    totalCost: number;
    totalMessages: number;
    potentialSavings: number;
    actualSavings: number;
    savingsPercentage: number;
    optimizationScore: number;
    costChange: number;
    messageChange: number;
    period: {
        start: Date;
        end: Date;
    };
}
export interface DailyStats {
    date: Date;
    totalCost: number;
    totalMessages: number;
    breakdown: CategoryBreakdown[];
    freeMessages: number;
    paidMessages: number;
}
export interface TrendData {
    current: number;
    previous: number;
    change: number;
    changePercentage: number;
    trend: 'up' | 'down' | 'stable';
}
export interface Recommendation {
    id: string;
    title: string;
    description: string;
    potentialSavings: number;
    savingsPercentage: number;
    priority: 'high' | 'medium' | 'low';
    actionable: boolean;
    steps?: string[];
    category: RecommendationCategory;
    implemented: boolean;
}
export type RecommendationCategory = 'timing' | 'classification' | 'volume' | 'template' | 'conversation';
export interface ReportOptions {
    accountId: string;
    startDate: Date;
    endDate: Date;
    format: 'json' | 'pdf' | 'csv';
    includeRecommendations: boolean;
    includeMessageDetails: boolean;
}
export interface CostReport {
    generatedAt: Date;
    period: {
        start: Date;
        end: Date;
    };
    account: {
        id: string;
        name: string;
        phoneNumber: string;
    };
    summary: {
        totalCost: number;
        totalMessages: number;
        freeMessages: number;
        paidMessages: number;
        potentialSavings: number;
        actualSavings: number;
        optimizationScore: number;
    };
    breakdown: CategoryBreakdown[];
    dailyData: DailyStats[];
    recommendations: Recommendation[];
    trends: {
        cost: TrendData;
        messages: TrendData;
        savings: TrendData;
    };
}
export interface WhatsAppWebhookPayload {
    object: 'whatsapp_business_account';
    entry: WhatsAppWebhookEntry[];
}
export interface WhatsAppWebhookEntry {
    id: string;
    changes: WhatsAppWebhookChange[];
}
export interface WhatsAppWebhookChange {
    value: {
        messaging_product: 'whatsapp';
        metadata: {
            display_phone_number: string;
            phone_number_id: string;
        };
        contacts?: WhatsAppContact[];
        messages?: WhatsAppIncomingMessage[];
        statuses?: WhatsAppMessageStatus[];
    };
    field: string;
}
export interface WhatsAppContact {
    profile: {
        name: string;
    };
    wa_id: string;
}
export interface WhatsAppIncomingMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
    image?: WhatsAppMedia;
    video?: WhatsAppMedia;
    audio?: WhatsAppMedia;
    document?: WhatsAppMedia;
    sticker?: WhatsAppMedia;
    location?: {
        latitude: number;
        longitude: number;
    };
    contacts?: WhatsAppContactMessage[];
    interactive?: {
        type: string;
        button_reply?: {
            id: string;
            title: string;
        };
        list_reply?: {
            id: string;
            title: string;
        };
    };
}
export interface WhatsAppMedia {
    id: string;
    mime_type?: string;
    sha256?: string;
    caption?: string;
}
export interface WhatsAppContactMessage {
    name: {
        formatted_name: string;
        first_name?: string;
        last_name?: string;
    };
    phones?: {
        phone: string;
        type: string;
    }[];
}
export interface WhatsAppMessageStatus {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
    conversation?: {
        id: string;
        expiration_timestamp?: string;
        origin: {
            type: string;
        };
    };
    pricing?: {
        billable: boolean;
        pricing_model: string;
        category: string;
    };
    errors?: {
        code: number;
        title: string;
        message: string;
    }[];
}
export interface AlertData {
    accountName: string;
    currentCost: number;
    previousCost: number;
    percentageChange: number;
    threshold: number;
}
export interface DailySummaryData {
    accountName: string;
    todayCost: number;
    messageCount: number;
    potentialSavings: number;
    topRecommendation?: string;
    optimizationScore: number;
}
export interface CreateSubscriptionInput {
    plan: Plan;
    paymentMethod: 'stripe' | 'xendit';
    currency: Currency;
}
export interface SubscriptionResponse {
    id: string;
    plan: Plan;
    status: 'active' | 'cancelled' | 'expired' | 'pending';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
}
export interface PaymentWebhookPayload {
    type: string;
    data: Record<string, unknown>;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: ApiMeta;
}
export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}
export interface ApiMeta {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
}
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
//# sourceMappingURL=index.d.ts.map