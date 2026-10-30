import { Router } from 'express';
import * as c from './start-here.controller.js';
const r = Router();
r.get('/', c.index);
r.get('/:slug', c.bySlug);
export default r;
