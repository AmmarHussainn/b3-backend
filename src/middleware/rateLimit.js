import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

const make = (windowMs, limit) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.tooMany()),
  });

export const globalLimiter = make(60_000, 300);
/** Use on login, forgot-password, set-password, reset-password. */
export const authLimiter = make(15 * 60_000, 20);
