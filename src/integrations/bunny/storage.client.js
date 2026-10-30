// Bunny Storage (resource files) + pull-zone token-signed downloads.
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { sha256Raw } from '../../utils/crypto.js';
import { bunnyFetch } from './http.js';

const need = () => {
  for (const n of ['BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_PASSWORD']) if (!env[n]) throw ApiError.upstream(`Bunny Storage is not configured (${n} missing)`);
  return { zone: env.BUNNY_STORAGE_ZONE, key: env.BUNNY_STORAGE_PASSWORD, host: env.BUNNY_STORAGE_HOST };
};
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const url = (p) => { const { zone, host } = need(); return `https://${host}/${zone}/${enc(p.replace(/^\//, ''))}`; };

export async function put(path, buffer, contentType = 'application/octet-stream') {
  const { key } = need();
  return bunnyFetch(url(path), { method: 'PUT', headers: { AccessKey: key, 'Content-Type': contentType }, body: buffer, timeoutMs: 120_000, parse: 'none' });
}
export async function remove(path) {
  const { key } = need();
  return bunnyFetch(url(path), { method: 'DELETE', headers: { AccessKey: key }, parse: 'none' });
}
/** Raw fetch Response (stream it to the member with an attachment disposition). */
export async function download(path) {
  const { key } = need();
  const res = await bunnyFetch(url(path), { headers: { AccessKey: key }, timeoutMs: 120_000, parse: 'raw' });
  if (!res.ok) throw ApiError.upstream(`Storage download failed (${res.status})`);
  return res;
}
/** Pull-zone token authentication: token = base64url(sha256(securityKey + path + expires)). */
export function signedDownloadUrl(path, ttlSeconds = 300) {
  const { BUNNY_PULLZONE_HOSTNAME: host, BUNNY_PULLZONE_TOKEN_KEY: key } = env;
  if (!host || !key) throw ApiError.upstream('Bunny pull zone is not configured (BUNNY_PULLZONE_HOSTNAME / BUNNY_PULLZONE_TOKEN_KEY)');
  const p = `/${path.replace(/^\//, '')}`;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = sha256Raw(`${key}${p}${expires}`).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { url: `https://${host}${enc(p)}?token=${token}&expires=${expires}`, expiresAt: new Date(expires * 1000).toISOString() };
}
