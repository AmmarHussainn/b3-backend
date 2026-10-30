import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './progress.validators.js';
import * as c from './progress.controller.js';

const r = Router();
r.get('/summary', c.summary);
r.get('/continue', c.resume);
r.put('/lessons/:lessonId/position', validate({ params: v.lessonParams, body: v.position }), c.position);
r.post('/lessons/:lessonId/complete', validate({ params: v.lessonParams }), c.complete);
r.delete('/lessons/:lessonId/complete', validate({ params: v.lessonParams }), c.incomplete);
export default r;
