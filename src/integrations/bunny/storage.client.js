import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { requireEnv } from '../../config/env.js';
import { bunnyFetch } from './http.js';

const storage = () => {
  const e = requireEnv('BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_PASSWORD', 'BUNNY_STORAGE_HOST');
  return { zone: e.BUNNY_STORAGE_ZONE, pass: e.BUNNY_STORAGE_PASSWORD, host: e.BUNNY_STORAGE_HOST };
};
const clean = (p) => p.replace(/^\/+/, '');

/** Upload a Buffer or Readable to the storage zone. path like "resources/cash-flow-worksheet/v1/b3-cash-flow-worksheet-v1.xlsx". */
export async function putFile(path, data) {
  const { zone, pass, host } = storage();
  const isStream = data instanceof Readable;
  await bunnyFetch(`https://${host}/${zone}/${clean(path)}`, {
    method: 'PUT',
    headers: { AccessKey: pass, 'content-type': 'application/octet-stream' },
    body: isStream ? Readable.toWeb(data) : data,
    duplex: isStream ? 'half' : undefined,
    timeoutMs: 5 * 60_000,
    raw: true,
  });
  return clean(path);
}

export async function deleteFile(path) {
  const { zone, pass, host } = storage();
  await bunnyFetch(`https://${host}/${zone}/${clean(path)}`, { method: 'DELETE', headers: { AccessKey: pass }, raw: true });
}

/**
 * Expiring download URL via the pull zone (Bunny CDN "Token Authentication" must be ON).
 * Add a pull-zone Edge Rule that sets `Content-Disposition: attachment` for the resources path
 * so files always download rather than preview.
 */
export function signedDownloadUrl(path, ttlSeconds = 300) {
  const { BUNNY_PULLZONE_HOSTNAME: host, BUNNY_PULLZONE_TOKEN_KEY: key } = requireEnv('BUNNY_PULLZONE_HOSTNAME', 'BUNNY_PULLZONE_TOKEN_KEY');
  const urlPath = `/${clean(path)}`;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = crypto.createHash('sha256').update(key + urlPath + expires).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `https://${host}${urlPath}?token=${token}&expires=${expires}`;
}
