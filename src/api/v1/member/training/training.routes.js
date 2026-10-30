import { Router } from 'express';
import * as c from './training.controller.js';
const r = Router();
r.get('/', c.library);
r.get('/courses/:courseSlug', c.course);
r.get('/courses/:courseSlug/lessons/:lessonSlug', c.lesson);
export default r;
