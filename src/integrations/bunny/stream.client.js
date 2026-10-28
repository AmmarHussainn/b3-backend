import { requireEnv } from '../../config/env.js';
import { sha256Hex } from '../../utils/crypto.js';
import { VIDEO_STATUS } from '../../config/constants.js';
import { bunnyFetch } from './http.js';

const API = 'https://video.bunnycdn.com';
const TUS_ENDPOINT = `${API}/tusupload`;

const cfg = () => {
  const e = requireEnv('BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY');
  return { lib: e.BUNNY_STREAM_LIBRARY_ID, key: e.BUNNY_STREAM_API_KEY };
};
const call = (path, opts = {}) => {
  const { lib, key } = cfg();
  return bunnyFetch(`${API}/library/${lib}${path}`, { ...opts, headers: { AccessKey: key, ...(opts.headers ?? {}) } });
};

/** Creates the video record in Bunny. The browser then uploads the file straight to Bunny (TUS). */
export const createVideo = (title) => call('/videos', { method: 'POST', json: { title } }); // -> { guid, ... }
export const getVideo = (guid) => call(`/videos/${guid}`);
export const deleteVideo = (guid) => call(`/videos/${guid}`, { method: 'DELETE' });

/**
 * Short-lived credentials for the admin browser's resumable upload.
 * Signature = sha256(libraryId + apiKey + expiration + videoId). The API key itself never leaves the server.
 */
export function getUploadCredentials(videoId, ttlSeconds = 6 * 3600) {
  const { lib, key } = cfg();
  const expire = Math.floor(Date.now() / 1000) + ttlSeconds;
  return {
    endpoint: TUS_ENDPOINT,
    headers: {
      AuthorizationSignature: sha256Hex(`${lib}${key}${expire}${videoId}`),
      AuthorizationExpire: String(expire),
      VideoId: videoId,
      LibraryId: lib,
    },
    expiresAt: expire,
  };
}

/**
 * Signed, expiring player URL for an entitled member. Requires in Bunny: Stream library >
 * Security > "Embed view token authentication" ON, and allowed referrers set to the portal domain.
 */
export function signEmbedUrl(videoId, ttlSeconds = 4 * 3600) {
  const { BUNNY_STREAM_LIBRARY_ID: lib, BUNNY_STREAM_TOKEN_KEY: tokenKey } = requireEnv('BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_TOKEN_KEY');
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = sha256Hex(`${tokenKey}${videoId}${expires}`);
  return `https://iframe.mediadelivery.net/embed/${lib}/${videoId}?token=${token}&expires=${expires}&preload=false`;
}

/** Captions / transcripts. vtt = WebVTT text. */
export const addCaption = (videoId, { srclang = 'en', label = 'English', vtt }) =>
  call(`/videos/${videoId}/captions/${srclang}`, {
    method: 'POST',
    json: { srclang, label, captionsFile: Buffer.from(vtt, 'utf8').toString('base64') },
  });
export const deleteCaption = (videoId, srclang) => call(`/videos/${videoId}/captions/${srclang}`, { method: 'DELETE' });

/** Bunny numeric status -> our VIDEO_STATUS. 0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished, 5 error, 6 upload failed. */
export function mapStatus(code) {
  if (code === 4) return VIDEO_STATUS.READY;
  if (code === 5 || code === 6) return VIDEO_STATUS.FAILED;
  if (code === 1 || code === 2 || code === 3) return VIDEO_STATUS.PROCESSING;
  return VIDEO_STATUS.UPLOADING;
}
