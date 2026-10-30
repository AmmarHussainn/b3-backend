import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { requireRole } from '../../../../middleware/requireRole.js';
import * as v from './provisioning.validators.js';
import * as c from './provisioning.controller.js';

const r = Router(); // mounted for owner + developer
r.get('/status', c.status);
r.get('/events', validate({ query: v.events }), c.events);
r.get('/events/:id', validate({ params: v.idParams }), c.event);
r.post('/events/:id/retry', validate({ params: v.idParams }), c.retry);
r.get('/errors', c.errors);
r.post('/reconcile', validate({ body: v.reconcile }), c.run);
r.post('/bulk/preview', validate({ body: v.rows }), c.preview);
r.get('/bulk/hubspot-rows', c.hubspotRows);
r.post('/bulk/load', requireRole('owner'), validate({ body: v.load }), c.load);
r.post('/bulk/send-welcome', requireRole('owner'), validate({ body: v.sendWelcome }), c.sendWelcome);
export default r;
