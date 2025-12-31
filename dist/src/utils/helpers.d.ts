import { Currency } from '@prisma/client';
/**
 * Get start of day in UTC
 */
export declare function startOfDay(date?: Date): Date;
/**
 * Get end of day in UTC
 */
export declare function endOfDay(date?: Date): Date;
/**
 * Get start of month in UTC
 */
export declare function startOfMonth(date?: Date): Date;
/**
 * Get end of month in UTC
 */
export declare function endOfMonth(date?: Date): Date;
/**
 * Get date N days ago
 */
export declare function daysAgo(days: number, from?: Date): Date;
/**
 * Get date N hours ago
 */
export declare function hoursAgo(hours: number, from?: Date): Date;
/**
 * Calculate hours between two dates
 */
export declare function hoursBetween(start: Date, end: Date): number;
/**
 * Check if date is within last N hours
 */
export declare function isWithinHours(date: Date, hours: number): boolean;
/**
 * Format date to ISO string for database
 */
export declare function toISOString(date: Date): string;
/**
 * Parse Unix timestamp to Date
 */
export declare function fromUnixTimestamp(timestamp: number): Date;
/**
 * Round to N decimal places
 */
export declare function round(value: number, decimals?: number): number;
/**
 * Format currency amount
 */
export declare function formatCurrency(amount: number, currency?: Currency): string;
/**
 * Calculate percentage
 */
export declare function percentage(part: number, total: number): number;
/**
 * Calculate percentage change
 */
export declare function percentageChange(current: number, previous: number): number;
/**
 * Convert USD to IDR (approximate)
 */
export declare function usdToIdr(usd: number, rate?: number): number;
/**
 * Convert IDR to USD (approximate)
 */
export declare function idrToUsd(idr: number, rate?: number): number;
/**
 * Generate a unique ID
 */
export declare function generateId(): string;
/**
 * Generate a short ID (8 chars)
 */
export declare function generateShortId(): string;
/**
 * Slugify a string
 */
export declare function slugify(text: string): string;
/**
 * Truncate string with ellipsis
 */
export declare function truncate(text: string, maxLength: number): string;
/**
 * Capitalize first letter
 */
export declare function capitalize(text: string): string;
/**
 * Convert to title case
 */
export declare function titleCase(text: string): string;
/**
 * Validate email format
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Validate phone number (E.164 format)
 */
export declare function isValidPhoneNumber(phone: string): boolean;
/**
 * Validate WhatsApp Business ID
 */
export declare function isValidWhatsAppBusinessId(id: string): boolean;
/**
 * Check if value is empty (null, undefined, empty string, or empty array)
 */
export declare function isEmpty(value: unknown): boolean;
/**
 * Group array items by a key
 */
export declare function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]>;
/**
 * Sum array of numbers
 */
export declare function sum(numbers: number[]): number;
/**
 * Calculate average of array of numbers
 */
export declare function average(numbers: number[]): number;
/**
 * Get unique values from array
 */
export declare function unique<T>(array: T[]): T[];
/**
 * Chunk array into smaller arrays
 */
export declare function chunk<T>(array: T[], size: number): T[][];
/**
 * Pick specific keys from an object
 */
export declare function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
/**
 * Omit specific keys from an object
 */
export declare function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * Deep clone an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Sleep for N milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
/**
 * Execute promises with concurrency limit
 */
export declare function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]>;
declare const _default: {
    startOfDay: typeof startOfDay;
    endOfDay: typeof endOfDay;
    startOfMonth: typeof startOfMonth;
    endOfMonth: typeof endOfMonth;
    daysAgo: typeof daysAgo;
    hoursAgo: typeof hoursAgo;
    hoursBetween: typeof hoursBetween;
    isWithinHours: typeof isWithinHours;
    toISOString: typeof toISOString;
    fromUnixTimestamp: typeof fromUnixTimestamp;
    round: typeof round;
    formatCurrency: typeof formatCurrency;
    percentage: typeof percentage;
    percentageChange: typeof percentageChange;
    usdToIdr: typeof usdToIdr;
    idrToUsd: typeof idrToUsd;
    generateId: typeof generateId;
    generateShortId: typeof generateShortId;
    slugify: typeof slugify;
    truncate: typeof truncate;
    capitalize: typeof capitalize;
    titleCase: typeof titleCase;
    isValidEmail: typeof isValidEmail;
    isValidPhoneNumber: typeof isValidPhoneNumber;
    isValidWhatsAppBusinessId: typeof isValidWhatsAppBusinessId;
    isEmpty: typeof isEmpty;
    groupBy: typeof groupBy;
    sum: typeof sum;
    average: typeof average;
    unique: typeof unique;
    chunk: typeof chunk;
    pick: typeof pick;
    omit: typeof omit;
    deepClone: typeof deepClone;
    sleep: typeof sleep;
    retry: typeof retry;
    parallelLimit: typeof parallelLimit;
};
export default _default;
//# sourceMappingURL=helpers.d.ts.map