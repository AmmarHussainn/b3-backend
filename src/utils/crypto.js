import crypto from 'node:crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hmacSha256Base64 = (key, data) => crypto.createHmac('sha256', key).update(data).digest('base64');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
