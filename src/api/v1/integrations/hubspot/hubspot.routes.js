import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './hubspot.validators.js';
import { receive } from './hubspot.controller.js';
const r = Router(); // authenticated by hubspotAuth (mounted)
r.post('/', validate({ body: v.body }), receive);
export default r;
