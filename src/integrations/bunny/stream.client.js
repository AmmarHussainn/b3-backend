// Bunny Stream: create video, TUS upload credentials, signed embed, captions, status mapping.
import { env } from '../../config/env.js';
import { VIDEO_STATUS } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { sha256 } from '../../utils/crypto.js';
import { bunnyFetch } from './http.js';

const API = 'https://video.bunnycdn.com';
const need = (...names) => {
  const out = {};
  for (const n of names) {
    if (!env[n]) throw ApiError.upstream(`Bunny Stream is not configured (${n} missing)`);
    out[n] = env[n];
  }
  return out;
};
const lib = () => need('BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY');
const auth = () => ({ AccessKey: lib().BUNNY_STREAM_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' });

export async function createVideo(title) {
  const { BUNNY_STREAM_LIBRARY_ID: id } = lib();
  return bunnyFetch(`${API}/library/${id}/videos`, { method: 'POST', headers: auth(), body: JSON.stringify({ title }) }); // { guid, ... }
}
export async function getVideo(guid) {
  const { BUNNY_STREAM_LIBRARY_ID: id } = lib();
  return bunnyFetch(`${API}/library/${id}/videos/${guid}`, { headers: auth() });
}
export async function deleteVideo(guid) {
  const { BUNNY_STREAM_LIBRARY_ID: id } = lib();
  return bunnyFetch(`${API}/library/${id}/videos/${guid}`, { method: 'DELETE', headers: auth(), parse: 'none' });
}
/** Short-lived TUS credentials: the browser uploads straight to Bunny, the file never touches this server. */
export function tusCredentials(videoId, ttlSeconds = 6 * 3600) {
  const { BUNNY_STREAM_LIBRARY_ID: libraryId, BUNNY_STREAM_API_KEY: apiKey } = lib();
  const expire = Math.floor(Date.now() / 1000) + ttlSeconds;
  return {
    endpoint: `${API}/tusupload`,
    expiresAt: new Date(expire * 1000).toISOString(),
    headers: {
      AuthorizationSignature: sha256(`${libraryId}${apiKey}${expire}${videoId}`),
      AuthorizationExpire: String(expire),
      VideoId: videoId,
      LibraryId: String(libraryId),
    },
  };
}
/** Signed, expiring embed URL (token authentication must be enabled on the library). */
export function signedEmbedUrl(videoId, ttlSeconds = 4 * 3600) {
  const { BUNNY_STREAM_LIBRARY_ID: libraryId, BUNNY_STREAM_TOKEN_KEY: key } = need('BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_TOKEN_KEY');
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = sha256(`${key}${videoId}${expires}`);
  return { url: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}`, expiresAt: new Date(expires * 1000).toISOString() };
}
export async function addCaption(guid, srclang, label, vttText) {
  const { BUNNY_STREAM_LIBRARY_ID: id } = lib();
  const captionsFile = Buffer.from(vttText, 'utf8').toString('base64');
  return bunnyFetch(`${API}/library/${id}/videos/${guid}/captions/${encodeURIComponent(srclang)}`, {
    method: 'POST', headers: auth(), body: JSON.stringify({ srclang, label, captionsFile }), parse: 'none',
  });
}
export async function deleteCaption(guid, srclang) {
  const { BUNNY_STREAM_LIBRARY_ID: id } = lib();
  return bunnyFetch(`${API}/library/${id}/videos/${guid}/captions/${encodeURIComponent(srclang)}`, { method: 'DELETE', headers: auth(), parse: 'none' });
}
export const thumbnailUrl = (guid, file = 'thumbnail.jpg') =>
  env.BUNNY_STREAM_CDN_HOSTNAME ? `https://${env.BUNNY_STREAM_CDN_HOSTNAME}/${guid}/${file}` : null;

/** Bunny status codes: 0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished, 5 error, 6 upload failed. */
export function mapStatus(code) {
  switch (Number(code)) {
    case 0: return VIDEO_STATUS.UPLOADING;
    case 1: case 2: case 3: return VIDEO_STATUS.PROCESSING;
    case 4: return VIDEO_STATUS.READY;
    case 5: case 6: return VIDEO_STATUS.FAILED;
    default: return null; // JIT statuses etc.: ignore
  }
}
