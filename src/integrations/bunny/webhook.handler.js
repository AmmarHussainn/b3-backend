import { mapStatus } from './stream.client.js';

/** Bunny Stream webhook body -> { libraryId, videoId, rawStatus, status }. Pure: DB work lives in video.service. */
export function parseStreamWebhook(body = {}) {
  const rawStatus = body.Status ?? body.status;
  return {
    libraryId: String(body.VideoLibraryId ?? body.videoLibraryId ?? ''),
    videoId: String(body.VideoGuid ?? body.videoGuid ?? ''),
    rawStatus,
    status: mapStatus(rawStatus),
  };
}
