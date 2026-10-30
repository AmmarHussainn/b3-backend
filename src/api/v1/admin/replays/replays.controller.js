import * as replays from '../../../../services/replay.service.js';
import * as lessons from '../../../../services/lesson.service.js';
import { ok, created } from '../../../../utils/response.js';
import { ApiError } from '../../../../utils/ApiError.js';

export const list = async (req, res) => ok(res, await replays.listByYear());
export const create = async (req, res) => created(res, await replays.create(req.valid.body, req.actor));
export const get = async (req, res) => ok(res, await lessons.get(req.valid.params.id));
export const update = async (req, res) => ok(res, await replays.update(req.valid.params.id, req.valid.body, req.actor));
export const action = async (req, res) => {
  const { id, action: a } = req.valid.params;
  if (a === 'remove' && req.valid.body.confirm !== true) throw ApiError.badRequest('Removing takes a replay down entirely. Send { "confirm": true }');
  ok(res, await lessons.transition(id, a, req.valid.body, req.actor));
};
