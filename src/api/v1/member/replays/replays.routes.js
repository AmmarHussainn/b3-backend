import { Router } from 'express';
import * as c from './replays.controller.js';
const r = Router();
r.get('/', c.list);
r.get('/:slug', c.bySlug);
export default r;
