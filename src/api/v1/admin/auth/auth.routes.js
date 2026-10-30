import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { authLimiter } from '../../../../middleware/rateLimit.js';
import { authAdmin } from '../../../../middleware/authAdmin.js';
import * as v from './auth.validators.js';
import * as c from './auth.controller.js';

const r = Router();
r.post('/login', authLimiter, validate({ body: v.login }), c.login);
r.post('/refresh', validate({ body: v.refresh }), c.refresh);
r.post('/logout', validate({ body: v.refresh }), c.logout);
r.post('/set-password', authLimiter, validate({ body: v.setPassword }), c.setPassword);
r.post('/forgot-password', authLimiter, validate({ body: v.forgot }), c.forgot);
r.post('/reset-password', authLimiter, validate({ body: v.reset }), c.reset);
r.post('/link-status', validate({ body: v.linkStatus }), c.linkStatus);
r.get('/me', authAdmin, c.me);
r.post('/change-password', authAdmin, validate({ body: v.change }), c.change);
export default r;
