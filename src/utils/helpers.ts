// =============================================================================
// MessageWise Optimizer - Utility Helper Functions
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Currency } from '@prisma/client';

// =============================================================================
// Date/Time Helpers
// =============================================================================

/**
 * Get start of day in UTC
 */
export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day in UTC
 */
export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of month in UTC
 */
export function startOfMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of month in UTC
 */
export function endOfMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Get date N days ago
 */
export function daysAgo(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/**
 * Get date N hours ago
 */
export function hoursAgo(hours: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(d.getUTCHours() - hours);
  return d;
}

/**
 * Calculate hours between two dates
 */
export function hoursBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Check if date is within last N hours
 */
export function isWithinHours(date: Date, hours: number): boolean {
  const threshold = hoursAgo(hours);
  return date >= threshold;
}

/**
 * Format date to ISO string for database
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Parse Unix timestamp to Date
 */
export function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

// =============================================================================
// Number/Currency Helpers
// =============================================================================

/**
 * Round to N decimal places
 */
export function round(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: Currency = 'USD'
): string {
  const locale = currency === 'IDR' ? 'id-ID' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount);
}

/**
 * Calculate percentage
 */
export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return round((part / total) * 100);
}

/**
 * Calculate percentage change
 */
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return round(((current - previous) / previous) * 100);
}

/**
 * Convert USD to IDR (approximate)
 */
export function usdToIdr(usd: number, rate: number = 15700): number {
  return Math.round(usd * rate);
}

/**
 * Convert IDR to USD (approximate)
 */
export function idrToUsd(idr: number, rate: number = 15700): number {
  return round(idr / rate, 4);
}

// =============================================================================
// String Helpers
// =============================================================================

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a short ID (8 chars)
 */
export function generateShortId(): string {
  return uuidv4().slice(0, 8);
}

/**
 * Slugify a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert to title case
 */
export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (E.164 format)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate WhatsApp Business ID
 */
export function isValidWhatsAppBusinessId(id: string): boolean {
  return /^\d{15,20}$/.test(id);
}

/**
 * Check if value is empty (null, undefined, empty string, or empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// =============================================================================
// Array Helpers
// =============================================================================

/**
 * Group array items by a key
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const key = keyFn(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
      return result;
    },
    {} as Record<string, T[]>
  );
}

/**
 * Sum array of numbers
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

/**
 * Calculate average of array of numbers
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Get unique values from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// =============================================================================
// Object Helpers
// =============================================================================

/**
 * Pick specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result as Omit<T, K>;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// =============================================================================
// Async Helpers
// =============================================================================

/**
 * Sleep for N milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Execute promises with concurrency limit
 */
export async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((e) => e === p),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

export default {
  // Date/Time
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  daysAgo,
  hoursAgo,
  hoursBetween,
  isWithinHours,
  toISOString,
  fromUnixTimestamp,
  // Number/Currency
  round,
  formatCurrency,
  percentage,
  percentageChange,
  usdToIdr,
  idrToUsd,
  // String
  generateId,
  generateShortId,
  slugify,
  truncate,
  capitalize,
  titleCase,
  // Validation
  isValidEmail,
  isValidPhoneNumber,
  isValidWhatsAppBusinessId,
  isEmpty,
  // Array
  groupBy,
  sum,
  average,
  unique,
  chunk,
  // Object
  pick,
  omit,
  deepClone,
  // Async
  sleep,
  retry,
  parallelLimit,
};
