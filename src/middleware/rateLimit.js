import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES as C } from '../config/constants.js';
import { isTest } from '../config/env.js';

const handler = (req, res, next) => next(new ApiError(C.RATE_LIMITED, 'Too many requests. Please slow down and try again shortly.'));

export const globalLimiter = rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip: () => isTest });

// Keyed by IP + email so the Next.js BFF (which proxies every user from one server) cannot lock everyone out.
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip: () => isTest,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase().slice(0, 100)}`,
});
