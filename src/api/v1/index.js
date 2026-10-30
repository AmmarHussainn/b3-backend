import { Router } from 'express';
import member from './member/index.js';
import admin from './admin/index.js';
import integrations from './integrations/index.js';

const router = Router();
router.use('/member', member);
router.use('/admin', admin);
router.use('/integrations', integrations);
export default router;
