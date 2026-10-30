import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './lessons.validators.js';
import * as c from './lessons.controller.js';

const r = Router();
r.get('/', validate({ query: v.list }), c.list);
r.post('/', validate({ body: v.create }), c.create);
r.put('/categories/:categoryId/order', validate({ params: v.categoryParams, body: v.flatOrder }), c.flatOrder); // Start Here ordering
r.get('/:id', validate({ params: v.idParams }), c.get);
r.patch('/:id', validate({ params: v.idParams, body: v.update }), c.update);
r.get('/:id/captions', validate({ params: v.idParams }), c.captions);
r.post('/:id/captions', validate({ params: v.idParams, body: v.caption }), c.addCaption);
r.delete('/:id/captions/:srclang', validate({ params: v.captionParams }), c.removeCaption);
r.post('/:id/:action', validate({ params: v.actionParams, body: v.actionBody }), c.action);
export default r;
