"use strict";
// =============================================================================
// MessageWise Optimizer - Utility Helper Functions
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOfDay = startOfDay;
exports.endOfDay = endOfDay;
exports.startOfMonth = startOfMonth;
exports.endOfMonth = endOfMonth;
exports.daysAgo = daysAgo;
exports.hoursAgo = hoursAgo;
exports.hoursBetween = hoursBetween;
exports.isWithinHours = isWithinHours;
exports.toISOString = toISOString;
exports.fromUnixTimestamp = fromUnixTimestamp;
exports.round = round;
exports.formatCurrency = formatCurrency;
exports.percentage = percentage;
exports.percentageChange = percentageChange;
exports.usdToIdr = usdToIdr;
exports.idrToUsd = idrToUsd;
exports.generateId = generateId;
exports.generateShortId = generateShortId;
exports.slugify = slugify;
exports.truncate = truncate;
exports.capitalize = capitalize;
exports.titleCase = titleCase;
exports.isValidEmail = isValidEmail;
exports.isValidPhoneNumber = isValidPhoneNumber;
exports.isValidWhatsAppBusinessId = isValidWhatsAppBusinessId;
exports.isEmpty = isEmpty;
exports.groupBy = groupBy;
exports.sum = sum;
exports.average = average;
exports.unique = unique;
exports.chunk = chunk;
exports.pick = pick;
exports.omit = omit;
exports.deepClone = deepClone;
exports.sleep = sleep;
exports.retry = retry;
exports.parallelLimit = parallelLimit;
const uuid_1 = require("uuid");
// =============================================================================
// Date/Time Helpers
// =============================================================================
/**
 * Get start of day in UTC
 */
function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
/**
 * Get end of day in UTC
 */
function endOfDay(date = new Date()) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}
/**
 * Get start of month in UTC
 */
function startOfMonth(date = new Date()) {
    const d = new Date(date);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
/**
 * Get end of month in UTC
 */
function endOfMonth(date = new Date()) {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}
/**
 * Get date N days ago
 */
function daysAgo(days, from = new Date()) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
}
/**
 * Get date N hours ago
 */
function hoursAgo(hours, from = new Date()) {
    const d = new Date(from);
    d.setUTCHours(d.getUTCHours() - hours);
    return d;
}
/**
 * Calculate hours between two dates
 */
function hoursBetween(start, end) {
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60);
}
/**
 * Check if date is within last N hours
 */
function isWithinHours(date, hours) {
    const threshold = hoursAgo(hours);
    return date >= threshold;
}
/**
 * Format date to ISO string for database
 */
function toISOString(date) {
    return date.toISOString();
}
/**
 * Parse Unix timestamp to Date
 */
function fromUnixTimestamp(timestamp) {
    return new Date(timestamp * 1000);
}
// =============================================================================
// Number/Currency Helpers
// =============================================================================
/**
 * Round to N decimal places
 */
function round(value, decimals = 2) {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
}
/**
 * Format currency amount
 */
function formatCurrency(amount, currency = 'USD') {
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
function percentage(part, total) {
    if (total === 0)
        return 0;
    return round((part / total) * 100);
}
/**
 * Calculate percentage change
 */
function percentageChange(current, previous) {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return round(((current - previous) / previous) * 100);
}
/**
 * Convert USD to IDR (approximate)
 */
function usdToIdr(usd, rate = 15700) {
    return Math.round(usd * rate);
}
/**
 * Convert IDR to USD (approximate)
 */
function idrToUsd(idr, rate = 15700) {
    return round(idr / rate, 4);
}
// =============================================================================
// String Helpers
// =============================================================================
/**
 * Generate a unique ID
 */
function generateId() {
    return (0, uuid_1.v4)();
}
/**
 * Generate a short ID (8 chars)
 */
function generateShortId() {
    return (0, uuid_1.v4)().slice(0, 8);
}
/**
 * Slugify a string
 */
function slugify(text) {
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
function truncate(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return `${text.slice(0, maxLength - 3)}...`;
}
/**
 * Capitalize first letter
 */
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
/**
 * Convert to title case
 */
function titleCase(text) {
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
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Validate phone number (E.164 format)
 */
function isValidPhoneNumber(phone) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
}
/**
 * Validate WhatsApp Business ID
 */
function isValidWhatsAppBusinessId(id) {
    return /^\d{15,20}$/.test(id);
}
/**
 * Check if value is empty (null, undefined, empty string, or empty array)
 */
function isEmpty(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === 'string')
        return value.trim().length === 0;
    if (Array.isArray(value))
        return value.length === 0;
    if (typeof value === 'object')
        return Object.keys(value).length === 0;
    return false;
}
// =============================================================================
// Array Helpers
// =============================================================================
/**
 * Group array items by a key
 */
function groupBy(array, keyFn) {
    return array.reduce((result, item) => {
        const key = keyFn(item);
        if (!result[key]) {
            result[key] = [];
        }
        result[key].push(item);
        return result;
    }, {});
}
/**
 * Sum array of numbers
 */
function sum(numbers) {
    return numbers.reduce((acc, n) => acc + n, 0);
}
/**
 * Calculate average of array of numbers
 */
function average(numbers) {
    if (numbers.length === 0)
        return 0;
    return sum(numbers) / numbers.length;
}
/**
 * Get unique values from array
 */
function unique(array) {
    return [...new Set(array)];
}
/**
 * Chunk array into smaller arrays
 */
function chunk(array, size) {
    const chunks = [];
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
function pick(obj, keys) {
    const result = {};
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
function omit(obj, keys) {
    const result = { ...obj };
    keys.forEach((key) => {
        delete result[key];
    });
    return result;
}
/**
 * Deep clone an object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
// =============================================================================
// Async Helpers
// =============================================================================
/**
 * Sleep for N milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
async function retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
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
async function parallelLimit(tasks, limit) {
    const results = [];
    const executing = [];
    for (const task of tasks) {
        const p = task().then((result) => {
            results.push(result);
        });
        executing.push(p);
        if (executing.length >= limit) {
            await Promise.race(executing);
            executing.splice(executing.findIndex((e) => e === p), 1);
        }
    }
    await Promise.all(executing);
    return results;
}
exports.default = {
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
//# sourceMappingURL=helpers.js.map