import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './replays.validators.js';
import * as c from './replays.controller.js';

const r = Router();
r.get('/', c.list);
r.post('/', validate({ body: v.create }), c.create);
r.get('/:id', validate({ params: v.idParams }), c.get);
r.patch('/:id', validate({ params: v.idParams, body: v.update }), c.update);
r.post('/:id/:action', validate({ params: v.actionParams, body: v.actionBody }), c.action);
export default r;
