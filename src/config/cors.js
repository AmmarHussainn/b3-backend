import { env } from './env.js';

export const allowedOrigins = [env.CLIENT_URL, env.ADMIN_URL, ...env.CORS_ORIGINS.split(',')]
  .map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

// Browsers never call this API directly (BFF), so this only allows the two frontends.
export const corsOptions = {
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: false,
};
