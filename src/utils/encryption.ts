// =============================================================================
// MessageWise Optimizer - Encryption Utilities
// =============================================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // If key is not 32 bytes, derive it using scrypt
  if (key.length !== 32) {
    const salt = crypto.createHash('sha256').update(key).digest().slice(0, SALT_LENGTH);
    return crypto.scryptSync(key, salt, KEY_LENGTH);
  }

  return Buffer.from(key, 'utf-8');
}

/**
 * Encrypt sensitive data
 * Returns base64 encoded string containing IV + encrypted data + auth tag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

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
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Hash a value using SHA-256
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate an API key
 * Format: mw_{random 32 chars}
 */
export function generateApiKey(): string {
  const random = crypto.randomBytes(24).toString('base64url');
  return `mw_${random}`;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitive(value: string, visibleChars: number = 4): string {
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
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a webhook signature
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return secureCompare(expectedSignature, signature);
}

export default {
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
