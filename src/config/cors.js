import { env } from './env.js';

// The Next.js apps call the API server-to-server (BFF), so browsers need no CORS access by default.
const allowed = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

export const corsOptions = {
  origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
  credentials: false,
};
