import 'dotenv/config';
import { z } from 'zod';

// PEM keys live in env with literal \n sequences; turn them back into newlines.
const pem = z.string().min(50, 'Run `npm run keys`').transform((s) => s.replace(/\\n/g, '\n'));
const opt = z.string().optional().transform((v) => (v === '' ? undefined : v));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  CLIENT_URL: z.string().url(),
  ADMIN_URL: z.string().url(),
  CORS_ORIGINS: z.string().default(''),

  MONGODB_URI: z.string().min(10),
  MONGODB_DB: z.string().default('b3_portal'),
  REDIS_URL: opt,

  JWT_ISSUER: z.string().default('b3-portal-api'),
  JWT_MEMBER_PRIVATE_KEY: pem,
  JWT_MEMBER_PUBLIC_KEY: pem,
  JWT_ADMIN_PRIVATE_KEY: pem,
  JWT_ADMIN_PUBLIC_KEY: pem,
  ACCESS_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 30),
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().default(10),
  INVITE_TTL_HOURS: z.coerce.number().default(72),
  RESET_TTL_MINUTES: z.coerce.number().default(60),

  HUBSPOT_ACCESS_TOKEN: opt,
  HUBSPOT_WEBHOOK_SECRET: opt,
  HUBSPOT_CLIENT_SECRET: opt,

  BUNNY_STREAM_LIBRARY_ID: opt,
  BUNNY_STREAM_API_KEY: opt,
  BUNNY_STREAM_TOKEN_KEY: opt,
  BUNNY_WEBHOOK_SECRET: opt,
  BUNNY_STORAGE_ZONE: opt,
  BUNNY_STORAGE_PASSWORD: opt,
  BUNNY_STORAGE_HOST: z.string().default('storage.bunnycdn.com'),
  BUNNY_PULLZONE_HOSTNAME: opt,
  BUNNY_PULLZONE_TOKEN_KEY: opt,

  EMAIL_PROVIDER_API_KEY: opt,
  EMAIL_FROM: z.string().default('Consult b3 <portal@consultb3.com>'),
  SENTRY_DSN: opt,
  // ---- added for the milestone code ----
  LOG_LEVEL: z.string().default('info'),
  RUN_JOBS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  RECONCILE_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'), // turn ON after the launch-day batch
  UPLOAD_MAX_MB: z.coerce.number().default(50),
  BUNNY_STREAM_CDN_HOSTNAME: opt, // e.g. vz-xxxx.b-cdn.net (thumbnails)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Throws a clear error when an optional integration var is missing at the moment it is needed. */
export function requireEnv(...names) {
  const out = {};
  for (const n of names) {
    if (!env[n]) throw new Error(`Missing required env var ${n}`);
    out[n] = env[n];
  }
  return out;
}
