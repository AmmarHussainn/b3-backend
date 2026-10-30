import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './search.validators.js';
import { get } from './search.controller.js';
const r = Router();
r.get('/', validate({ query: v.query }), get);
export default r;
