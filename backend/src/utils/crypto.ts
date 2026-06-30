import crypto from 'crypto';

/**
 * Calculates HMAC SHA-256 signature of a payload using an endpoint secret.
 */
export function calculateHmacSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}
