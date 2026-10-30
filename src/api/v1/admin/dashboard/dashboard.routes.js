import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import * as v from './dashboard.validators.js';
import { get, getActivity } from './dashboard.controller.js';

const r = Router();
r.get('/', get);
r.get('/stats', get); // alias: your frontend calls /dashboard/stats
r.get('/activity', validate({ query: v.activity }), getActivity);
export default r;
