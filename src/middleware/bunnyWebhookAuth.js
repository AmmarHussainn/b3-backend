import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { safeEqual } from '../utils/crypto.js';

/** Bunny Stream webhooks are unsigned, so put a long random secret in the webhook URL: /bunny/webhook?secret=... */
export function bunnyWebhookAuth(req, _res, next) {
  const s = req.query.secret;
  return env.BUNNY_WEBHOOK_SECRET && s && safeEqual(s, env.BUNNY_WEBHOOK_SECRET) ? next() : next(ApiError.unauthorized());
}
