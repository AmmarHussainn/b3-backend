import * as training from '../../../../services/training.service.js';
import { ok, created, paginated } from '../../../../utils/response.js';
import { ApiError } from '../../../../utils/ApiError.js';

export const containers = async (req, res) => ok(res, await training.listContainers());
export const createContainer = async (req, res) => created(res, await training.createContainer(req.valid.body, req.actor));
export const createCourse = async (req, res) => created(res, await training.createCourse(req.valid.body, req.actor));
export const getCourse = async (req, res) => ok(res, await training.getCourse(req.valid.params.id));
export const updateCourse = async (req, res) => ok(res, await training.updateCourse(req.valid.params.id, req.valid.body, req.actor));
export const move = async (req, res) => ok(res, await training.moveCourse(req.valid.params.id, req.valid.body.productId, req.actor));
export const reorder = async (req, res) => ok(res, await training.reorderLessons(req.valid.params.id, req.valid.body.lessonIds, req.actor));
export const action = async (req, res) => {
  const { id, action: a } = req.valid.params;
  if (a === 'remove' && req.valid.body.confirm !== true) throw ApiError.badRequest('Send { "confirm": true } to remove a course');
  ok(res, await training.courseTransition(id, a, req.valid.body, req.actor));
};

export const removeContainer = async (req, res) => ok(res, await training.removeContainer(req.valid.params.id, req.valid.query.mode, req.actor));
export const listCourses = async (req, res) => paginated(res, await training.listCourses(req.valid.query));
