import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { hmacSha256Base64, safeEqual } from '../utils/crypto.js';

/**
 * Accepts EITHER:
 *  - a shared secret (header x-b3-webhook-secret or ?secret=) set in the HubSpot workflow webhook, OR
 *  - a valid HubSpot v3 signature (needs req.rawBody, set in app.js).
 */
export function hubspotAuth(req, _res, next) {
  const provided = req.get('x-b3-webhook-secret') || req.query.secret;
  if (env.HUBSPOT_WEBHOOK_SECRET && provided && safeEqual(provided, env.HUBSPOT_WEBHOOK_SECRET)) return next();

  const sig = req.get('x-hubspot-signature-v3');
  const ts = req.get('x-hubspot-request-timestamp');
  if (sig && ts && env.HUBSPOT_CLIENT_SECRET && Math.abs(Date.now() - Number(ts)) < 5 * 60_000) {
    const source = req.method + env.PUBLIC_API_URL + req.originalUrl + (req.rawBody?.toString('utf8') ?? '') + ts;
    if (safeEqual(sig, hmacSha256Base64(env.HUBSPOT_CLIENT_SECRET, source))) return next();
  }
  next(ApiError.unauthorized());
}
