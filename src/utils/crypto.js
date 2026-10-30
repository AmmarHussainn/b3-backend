import crypto from 'node:crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const sha256Raw = (s) => crypto.createHash('sha256').update(s).digest();
export const hmacSha256 = (key, data, enc = 'hex') => crypto.createHmac('sha256', key).update(data).digest(enc);
export const uuid = () => crypto.randomUUID();
export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
