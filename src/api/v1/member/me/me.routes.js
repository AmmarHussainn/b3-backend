import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './me.validators.js';
import * as c from './me.controller.js';

const r = Router();
r.get('/', c.me);
r.patch('/', validate({ body: v.update }), c.update);
r.get('/links', c.links);
r.post('/support', validate({ body: v.support }), c.support);
export default r;
