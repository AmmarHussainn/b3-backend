import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { requireRole } from '../../../../middleware/requireRole.js';
import * as v from './training.validators.js';
import * as c from './training.controller.js';

const r = Router();
r.get('/containers', c.containers);
r.post('/containers', requireRole('owner'), validate({ body: v.createContainer }), c.createContainer);
r.post('/courses', validate({ body: v.createCourse }), c.createCourse);
r.get('/courses/:id', validate({ params: v.idParams }), c.getCourse);
r.patch('/courses/:id', validate({ params: v.idParams, body: v.updateCourse }), c.updateCourse);
r.post('/courses/:id/move', requireRole('owner'), validate({ params: v.idParams, body: v.move }), c.move);
r.put('/courses/:id/lessons/order', validate({ params: v.idParams, body: v.order }), c.reorder);
r.post('/courses/:id/:action', validate({ params: v.actionParams, body: v.actionBody }), c.action);
r.delete('/containers/:id', requireRole('owner'), validate({ params: v.idParams, query: v.removeContainer }), c.removeContainer);
r.get('/courses', validate({ query: v.listCourses }), c.listCourses);
export default r;
