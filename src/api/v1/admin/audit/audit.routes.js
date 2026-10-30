import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './audit.validators.js';
import { get } from './audit.controller.js';
const r = Router();
r.get('/', validate({ query: v.list }), get);
export default r;
