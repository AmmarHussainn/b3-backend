import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { requireRole } from '../../../../middleware/requireRole.js';
import * as v from './reports.validators.js';
import * as c from './reports.controller.js';
const r = Router();
r.get('/engagement', validate({ query: v.engagement }), c.engagement);
r.get('/inactive', validate({ query: v.inactive }), c.inactive);
r.get('/export', validate({ query: v.exportQ }), c.exportData);
r.get('/completions', requireRole('owner'), validate({ query: v.completions }), c.completions); // owner only, as your spec says
export default r;
