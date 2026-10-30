import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './structure.validators.js';
import * as c from './structure.controller.js';
const r = Router(); // owner only (mounted)
r.get('/', c.overview);
r.patch('/products/:id', validate({ params: v.idParams, body: v.updateProduct }), c.updateProduct);
export default r;
