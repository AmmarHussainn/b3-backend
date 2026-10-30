import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './resources.validators.js';
import * as c from './resources.controller.js';

const r = Router();
r.get('/', validate({ query: v.list }), c.list);
r.get('/:id', validate({ params: v.idParams }), c.get);
r.get('/:id/download', validate({ params: v.idParams }), c.downloadUrl);
r.get('/:id/file', validate({ params: v.idParams }), c.file);
export default r;
