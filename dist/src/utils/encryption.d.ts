/**
 * Encrypt sensitive data
 * Returns base64 encoded string containing IV + encrypted data + auth tag
 */
export declare function encrypt(plaintext: string): string;
/**
 * Decrypt encrypted data
 * Expects base64 encoded string containing IV + encrypted data + auth tag
 */
export declare function decrypt(encryptedData: string): string;
/**
 * Hash a value using SHA-256
 */
export declare function hash(value: string): string;
/**
 * Generate a secure random token
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Generate an API key
 * Format: mw_{random 32 chars}
 */
export declare function generateApiKey(): string;
/**
 * Hash API key for storage
 */
export declare function hashApiKey(apiKey: string): string;
/**
 * Mask sensitive data for logging
 */
export declare function maskSensitive(value: string, visibleChars?: number): string;
/**
 * Compare two strings in constant time (timing-safe)
 */
export declare function secureCompare(a: string, b: string): boolean;
/**
 * Generate a webhook signature
 */
export declare function generateWebhookSignature(payload: string, secret: string): string;
/**
 * Verify a webhook signature
 */
export declare function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
declare const _default: {
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    hash: typeof hash;
    generateSecureToken: typeof generateSecureToken;
    generateApiKey: typeof generateApiKey;
    hashApiKey: typeof hashApiKey;
    maskSensitive: typeof maskSensitive;
    secureCompare: typeof secureCompare;
    generateWebhookSignature: typeof generateWebhookSignature;
    verifyWebhookSignature: typeof verifyWebhookSignature;
};
export default _default;
//# sourceMappingURL=encryption.d.ts.map