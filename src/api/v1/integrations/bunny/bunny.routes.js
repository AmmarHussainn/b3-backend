import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './bunny.validators.js';
import { receive } from './bunny.controller.js';
const r = Router(); // authenticated by bunnyWebhookAuth (mounted)
r.post('/', validate({ body: v.body }), receive);
export default r;
