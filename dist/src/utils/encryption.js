"use strict";
// =============================================================================
// MessageWise Optimizer - Encryption Utilities
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.hash = hash;
exports.generateSecureToken = generateSecureToken;
exports.generateApiKey = generateApiKey;
exports.hashApiKey = hashApiKey;
exports.maskSensitive = maskSensitive;
exports.secureCompare = secureCompare;
exports.generateWebhookSignature = generateWebhookSignature;
exports.verifyWebhookSignature = verifyWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
/**
 * Get encryption key from environment
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    // If key is not 32 bytes, derive it using scrypt
    if (key.length !== 32) {
        const salt = crypto_1.default.createHash('sha256').update(key).digest().slice(0, SALT_LENGTH);
        return crypto_1.default.scryptSync(key, salt, KEY_LENGTH);
    }
    return Buffer.from(key, 'utf-8');
}
/**
 * Encrypt sensitive data
 * Returns base64 encoded string containing IV + encrypted data + auth tag
 */
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Combine IV + encrypted data + auth tag
    const combined = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'hex'),
        authTag,
    ]);
    return combined.toString('base64');
}
/**
 * Decrypt encrypted data
 * Expects base64 encoded string containing IV + encrypted data + auth tag
 */
function decrypt(encryptedData) {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    // Extract IV, encrypted data, and auth tag
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
}
/**
 * Hash a value using SHA-256
 */
function hash(value) {
    return crypto_1.default.createHash('sha256').update(value).digest('hex');
}
/**
 * Generate a secure random token
 */
function generateSecureToken(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
/**
 * Generate an API key
 * Format: mw_{random 32 chars}
 */
function generateApiKey() {
    const random = crypto_1.default.randomBytes(24).toString('base64url');
    return `mw_${random}`;
}
/**
 * Hash API key for storage
 */
function hashApiKey(apiKey) {
    return crypto_1.default.createHash('sha256').update(apiKey).digest('hex');
}
/**
 * Mask sensitive data for logging
 */
function maskSensitive(value, visibleChars = 4) {
    if (value.length <= visibleChars * 2) {
        return '*'.repeat(value.length);
    }
    const start = value.slice(0, visibleChars);
    const end = value.slice(-visibleChars);
    const masked = '*'.repeat(Math.min(value.length - visibleChars * 2, 8));
    return `${start}${masked}${end}`;
}
/**
 * Compare two strings in constant time (timing-safe)
 */
function secureCompare(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(bufA, bufB);
}
/**
 * Generate a webhook signature
 */
function generateWebhookSignature(payload, secret) {
    return crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
}
/**
 * Verify a webhook signature
 */
function verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = generateWebhookSignature(payload, secret);
    return secureCompare(expectedSignature, signature);
}
exports.default = {
    encrypt,
    decrypt,
    hash,
    generateSecureToken,
    generateApiKey,
    hashApiKey,
    maskSensitive,
    secureCompare,
    generateWebhookSignature,
    verifyWebhookSignature,
};
//# sourceMappingURL=encryption.js.map