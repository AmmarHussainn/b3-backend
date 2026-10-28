import { Router } from 'express';
import member from './member/index.js';
import admin from './admin/index.js';
import integrations from './integrations/index.js';

const router = Router();
router.use('/member', member);           // clients (Next.js client portal)
router.use('/admin', admin);             // b3 team (Next.js admin portal)
router.use('/integrations', integrations); // HubSpot + Bunny, server-to-server

export default router;
