// Bunny Stream lifecycle for a lesson. Replacing a video never changes the lesson id, so progress survives.
import { Lesson } from '../db/models/index.js';
import { VIDEO_STATUS as V, CONTENT_STATUS as CS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import * as stream from '../integrations/bunny/stream.client.js';
import { parseStreamWebhook } from '../integrations/bunny/webhook.handler.js';
import * as audit from './audit.service.js';

const need = async (id) => { const l = await Lesson.findById(id); if (!l) throw ApiError.notFound('Lesson not found'); return l; };

/** First upload: creates the Bunny video, returns TUS credentials for a direct browser upload. */
export async function createUpload(lessonId, actor) {
  const l = await need(lessonId);
  if (l.bunnyVideoId) throw ApiError.conflict('This lesson already has a video. Use replace instead.');
  const v = await stream.createVideo(l.title);
  l.bunnyVideoId = v.guid; l.videoStatus = V.UPLOADING; await l.save();
  await audit.log({ actor, action: 'video.create', entity: 'lesson', entityId: lessonId, after: { videoId: v.guid } });
  return { videoId: v.guid, upload: stream.tusCredentials(v.guid) };
}
/** Replace: the old video keeps playing until the new one has encoded, then they are swapped. */
export async function replaceUpload(lessonId, actor) {
  const l = await need(lessonId);
  if (!l.bunnyVideoId) return createUpload(lessonId, actor);
  if (l.pendingBunnyVideoId) await stream.deleteVideo(l.pendingBunnyVideoId).catch(() => {});
  const v = await stream.createVideo(l.title);
  l.pendingBunnyVideoId = v.guid; await l.save();
  await audit.log({ actor, action: 'video.replace-start', entity: 'lesson', entityId: lessonId, after: { pending: v.guid } });
  return { videoId: v.guid, upload: stream.tusCredentials(v.guid), note: 'The current video keeps playing until the new one is ready. Captions must be re-uploaded after the swap.' };
}

async function finalizeSwap(l) {
  const old = l.bunnyVideoId;
  l.bunnyVideoId = l.pendingBunnyVideoId; l.pendingBunnyVideoId = undefined; l.captions = [];
  await applyDetails(l, l.bunnyVideoId);
  l.videoStatus = V.READY;
  if (old) await stream.deleteVideo(old).catch((e) => logger.warn({ err: e.message }, 'old video delete failed'));
}
async function applyDetails(l, guid) {
  try {
    const d = await stream.getVideo(guid);
    if (d?.length) l.durationSeconds = Math.round(d.length);
    l.thumbnailUrl = stream.thumbnailUrl(guid, d?.thumbnailFileName) || l.thumbnailUrl;
  } catch (e) { logger.warn({ err: e.message }, 'could not fetch video details'); }
}

/** Apply a Bunny status to the lesson that owns the video (current or pending). Idempotent and order-tolerant. */
export async function applyStatus(l, guid, mapped) {
  if (!mapped) return l;
  if (guid === l.pendingBunnyVideoId) {
    if (mapped === V.READY) await finalizeSwap(l);
    else if (mapped === V.FAILED) l.pendingBunnyVideoId = undefined;
  } else if (guid === l.bunnyVideoId) {
    if (l.videoStatus === V.READY && mapped !== V.FAILED) return l; // never regress ready -> processing
    l.videoStatus = mapped;
    if (mapped === V.READY) await applyDetails(l, guid);
  } else return l;
  await l.save();
  return l;
}

export async function handleWebhook(body) {
  const w = parseStreamWebhook(body);
  if (!w.videoId) return { ignored: true };
  const l = await Lesson.findOne({ $or: [{ bunnyVideoId: w.videoId }, { pendingBunnyVideoId: w.videoId }] });
  if (!l) return { ignored: true };
  await applyStatus(l, w.videoId, w.status);
  return { ok: true, lessonId: String(l._id), status: w.status };
}

/** Admin polling (works even if the webhook is not configured yet). */
export async function refreshStatus(lessonId) {
  const l = await need(lessonId);
  const out = { videoId: l.bunnyVideoId || null, status: l.videoStatus, durationSeconds: l.durationSeconds || null, pending: null };
  if (l.pendingBunnyVideoId) {
    const d = await stream.getVideo(l.pendingBunnyVideoId).catch(() => null);
    if (d) await applyStatus(l, l.pendingBunnyVideoId, stream.mapStatus(d.status));
    out.pending = { videoId: l.pendingBunnyVideoId, status: d ? stream.mapStatus(d.status) : 'unknown', encodeProgress: d?.encodeProgress ?? null };
  }
  if (l.bunnyVideoId && l.videoStatus !== V.READY) {
    const d = await stream.getVideo(l.bunnyVideoId).catch(() => null);
    if (d) { await applyStatus(l, l.bunnyVideoId, stream.mapStatus(d.status)); out.status = l.videoStatus; out.encodeProgress = d.encodeProgress ?? null; out.durationSeconds = l.durationSeconds || null; }
  }
  return out;
}
export async function remove(lessonId, actor) {
  const l = await need(lessonId);
  if (l.status === CS.LIVE) throw ApiError.conflict('Unpublish the lesson before deleting its video');
  for (const g of [l.bunnyVideoId, l.pendingBunnyVideoId].filter(Boolean)) await stream.deleteVideo(g).catch((e) => logger.warn({ err: e.message }, 'video delete failed'));
  Object.assign(l, { bunnyVideoId: undefined, pendingBunnyVideoId: undefined, videoStatus: V.NONE, durationSeconds: undefined, thumbnailUrl: undefined, captions: [] });
  await l.save();
  await audit.log({ actor, action: 'video.delete', entity: 'lesson', entityId: lessonId });
}
export async function previewUrl(lessonId) {
  const l = await need(lessonId);
  if (!l.bunnyVideoId || l.videoStatus !== V.READY) throw ApiError.conflict('Video is not ready yet');
  return stream.signedEmbedUrl(l.bunnyVideoId, 3600);
}
