import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './videos.validators.js';
import * as c from './videos.controller.js';

const r = Router();
const p = validate({ params: v.lessonParams });
r.post('/lessons/:lessonId/upload', p, c.upload);
r.post('/lessons/:lessonId/replace', p, c.replace);
r.get('/lessons/:lessonId/status', p, c.status);
r.get('/lessons/:lessonId/preview', p, c.preview);
r.delete('/lessons/:lessonId', p, c.remove);
export default r;
