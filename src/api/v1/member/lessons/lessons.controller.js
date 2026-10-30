import * as content from '../../../../services/content.service.js';
import { ok } from '../../../../utils/response.js';

export const resolve = async (req, res) => {
  const ctx = await content.resolveLessonBySlugs(req.valid.query.category, req.valid.query.lesson, req.entitlements);
  ok(res, await content.lessonDetail(ctx, req.user.id, req.entitlements));
};
export const get = async (req, res) => {
  const ctx = await content.getAccessibleLesson(req.valid.params.id, req.entitlements);
  ok(res, await content.lessonDetail(ctx, req.user.id, req.entitlements));
};
export const playback = async (req, res) => ok(res, content.playback(await content.getAccessibleLesson(req.valid.params.id, req.entitlements)));
