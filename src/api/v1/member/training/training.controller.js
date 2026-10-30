import * as content from '../../../../services/content.service.js';
import { ok } from '../../../../utils/response.js';

export const library = async (req, res) => ok(res, await content.getTrainingLibrary(req.entitlements, req.user.id));
export const course = async (req, res) => ok(res, await content.getCourse(req.params.courseSlug, req.entitlements, req.user.id));
export const lesson = async (req, res) => {
  const ctx = await content.resolveLessonBySlugs(req.params.courseSlug, req.params.lessonSlug, req.entitlements);
  ok(res, await content.lessonDetail(ctx, req.user.id, req.entitlements));
};
