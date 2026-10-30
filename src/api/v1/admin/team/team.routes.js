import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './team.validators.js';
import * as c from './team.controller.js';
const r = Router(); // owner only (mounted)
r.get('/', c.list);
r.post('/invite', validate({ body: v.invite }), c.invite);
r.patch('/:id', validate({ params: v.idParams, body: v.update }), c.update);
r.post('/:id/resend-invite', validate({ params: v.idParams }), c.resendInvite);
export default r;
