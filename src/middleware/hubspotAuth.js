import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { hmacSha256, safeEqual } from '../utils/crypto.js';

const MAX_SKEW_MS = 5 * 60_000;

/**
 * Accepts EITHER:
 *  a) HubSpot v3 signature (X-HubSpot-Signature-v3 + X-HubSpot-Request-Timestamp) verified with HUBSPOT_CLIENT_SECRET, or
 *  b) a shared secret in the `x-webhook-secret` header (or `Authorization: Bearer <secret>`) = HUBSPOT_WEBHOOK_SECRET.
 * Fails closed when neither is configured.
 */
export function hubspotAuth(req, res, next) {
  const sig = req.get('x-hubspot-signature-v3');
  if (sig && env.HUBSPOT_CLIENT_SECRET) {
    const ts = req.get('x-hubspot-request-timestamp');
    if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return next(ApiError.unauthorized('Stale or missing webhook timestamp'));
    const uri = `${env.PUBLIC_API_URL.replace(/\/$/, '')}${req.originalUrl}`;
    const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
    const expected = hmacSha256(env.HUBSPOT_CLIENT_SECRET, `${req.method}${uri}${raw}${ts}`, 'base64');
    return safeEqual(sig, expected) ? next() : next(ApiError.unauthorized('Bad webhook signature'));
  }
  if (env.HUBSPOT_WEBHOOK_SECRET) {
    const given = req.get('x-webhook-secret') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (given && safeEqual(given, env.HUBSPOT_WEBHOOK_SECRET)) return next();
  }
  next(ApiError.unauthorized('Webhook authentication failed'));
}
