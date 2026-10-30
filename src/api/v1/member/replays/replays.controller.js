import * as content from '../../../../services/content.service.js';
import { ok } from '../../../../utils/response.js';
import { ApiError } from '../../../../utils/ApiError.js';

export const list = async (req, res) => ok(res, await content.getReplays(req.entitlements, req.user.id));
export const bySlug = async (req, res) => {
  const years = (await content.getReplays(req.entitlements, req.user.id)).years;
  const hit = years.flatMap((y) => y.replays).find((r) => r.slug === req.params.slug);
  if (!hit) throw ApiError.notFound('Replay not found');
  const ctx = await content.getAccessibleLesson(hit.id, req.entitlements);
  ok(res, await content.lessonDetail(ctx, req.user.id, req.entitlements));
};
