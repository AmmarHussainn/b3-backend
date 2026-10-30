import * as content from '../../../../services/content.service.js';
import { ok } from '../../../../utils/response.js';
import { ApiError } from '../../../../utils/ApiError.js';

export const index = async (req, res) => ok(res, await content.getStartHere(req.entitlements));
export const bySlug = async (req, res) => {
  const hit = (await content.getStartHere(req.entitlements)).lessons.find((l) => l.slug === req.params.slug);
  if (!hit) throw ApiError.notFound('Page not found');
  const ctx = await content.getAccessibleLesson(hit.id, req.entitlements);
  ok(res, await content.lessonDetail(ctx, req.user.id, req.entitlements));
};
