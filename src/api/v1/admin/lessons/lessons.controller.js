import * as lessons from '../../../../services/lesson.service.js';
import { ok, created, paginated } from '../../../../utils/response.js';
import { ApiError } from '../../../../utils/ApiError.js';

export const list = async (req, res) => paginated(res, await lessons.list(req.valid.query));
export const create = async (req, res) => created(res, await lessons.create(req.valid.body, req.actor));
export const get = async (req, res) => ok(res, await lessons.get(req.valid.params.id));
export const update = async (req, res) => ok(res, await lessons.update(req.valid.params.id, req.valid.body, req.actor));
export const action = async (req, res) => {
  const { id, action: a } = req.valid.params;
  if (a === 'remove' && req.valid.body.confirm !== true) throw ApiError.badRequest('Send { "confirm": true } to remove a lesson');
  ok(res, await lessons.transition(id, a, req.valid.body, req.actor));
};
export const captions = async (req, res) => ok(res, await lessons.listCaptions(req.valid.params.id));
export const addCaption = async (req, res) => created(res, await lessons.addCaption(req.valid.params.id, req.valid.body, req.actor));
export const removeCaption = async (req, res) => ok(res, await lessons.removeCaption(req.valid.params.id, req.valid.params.srclang, req.actor));
export const flatOrder = async (req, res) => { await lessons.reorderFlat(req.valid.params.categoryId, req.valid.body.lessonIds, req.actor); ok(res, { ok: true }); };
