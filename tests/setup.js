// Runs before every test file: environment (incl. throw-away JWT keys) must exist before src/config/env.js is imported.
import { generateKeyPairSync } from 'node:crypto';

const pem = () => { const k = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }); return { priv: k.privateKey.replace(/\n/g, '\\n'), pub: k.publicKey.replace(/\n/g, '\\n') }; };
const m = pem(); const a = pem();
Object.assign(process.env, {
  NODE_ENV: 'test', CLIENT_URL: 'http://localhost:3000', ADMIN_URL: 'http://localhost:3001', MONGODB_URI: 'mongodb://placeholder-overridden',
  JWT_MEMBER_PRIVATE_KEY: m.priv, JWT_MEMBER_PUBLIC_KEY: m.pub, JWT_ADMIN_PRIVATE_KEY: a.priv, JWT_ADMIN_PUBLIC_KEY: a.pub,
  HUBSPOT_WEBHOOK_SECRET: 'test-webhook-secret', BUNNY_WEBHOOK_SECRET: 'test-bunny-secret',
  BUNNY_STREAM_LIBRARY_ID: '12345', BUNNY_STREAM_API_KEY: 'api-key', BUNNY_STREAM_TOKEN_KEY: 'token-key',
});
