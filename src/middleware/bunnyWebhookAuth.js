import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { safeEqual } from '../utils/crypto.js';

/** Bunny Stream webhooks cannot send custom headers, so the secret rides in the URL: ?secret=... (or x-bunny-secret). */
export function bunnyWebhookAuth(req, res, next) {
  if (!env.BUNNY_WEBHOOK_SECRET) return next(ApiError.unauthorized('Bunny webhook secret is not configured'));
  const given = req.get('x-bunny-secret') || req.query.secret;
  if (given && safeEqual(given, env.BUNNY_WEBHOOK_SECRET)) return next();
  next(ApiError.unauthorized('Webhook authentication failed'));
}
