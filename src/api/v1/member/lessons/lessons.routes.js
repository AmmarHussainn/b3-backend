import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './lessons.validators.js';
import * as c from './lessons.controller.js';

const r = Router();
r.get('/resolve', validate({ query: v.resolve }), c.resolve);
r.get('/:id', validate({ params: v.idParams }), c.get);
r.get('/:id/playback', validate({ params: v.idParams }), c.playback);
export default r;
