import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { requireRole } from '../../../../middleware/requireRole.js';
import * as v from './clients.validators.js';
import * as c from './clients.controller.js';

const r = Router();
r.get('/', validate({ query: v.list }), c.list); // owner, content_admin, developer (read-only spot checks)
r.post('/comp', requireRole('owner'), validate({ body: v.comp }), c.comp);
r.get('/:id', validate({ params: v.idParams }), c.get);
r.post('/:id/revoke', requireRole('owner'), validate({ params: v.idParams, body: v.revoke }), c.revoke);
r.post('/:id/resend-welcome', requireRole('owner', 'developer'), validate({ params: v.idParams }), c.resendWelcome);
r.post('/:id/retry-writeback', requireRole('owner', 'developer'), validate({ params: v.idParams }), c.retryWriteback);
r.post('/:id/reconcile', requireRole('owner', 'developer'), validate({ params: v.idParams, body: v.reconcile }), c.reconcile);
export default r;
