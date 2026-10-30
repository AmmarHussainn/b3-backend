import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './settings.validators.js';
import * as c from './settings.controller.js';
const r = Router(); // owner only (mounted)
r.get('/', c.list);
r.put('/:key', validate({ params: v.keyParams, body: v.body }), c.set);
export default r;
