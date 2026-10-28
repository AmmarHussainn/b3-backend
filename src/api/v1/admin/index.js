import { Router } from 'express';
import { authAdmin } from '../../../middleware/authAdmin.js';
import { requireRole } from '../../../middleware/requireRole.js';
import auth from './auth/auth.routes.js';
import dashboard from './dashboard/dashboard.routes.js';
import replays from './replays/replays.routes.js';
import training from './training/training.routes.js';
import lessons from './lessons/lessons.routes.js';
import videos from './videos/videos.routes.js';
import resources from './resources/resources.routes.js';
import clients from './clients/clients.routes.js';
import provisioning from './provisioning/provisioning.routes.js';
import structure from './structure/structure.routes.js';
import team from './team/team.routes.js';
import settings from './settings/settings.routes.js';
import reports from './reports/reports.routes.js';
import audit from './audit/audit.routes.js';

const router = Router();

router.use('/auth', auth); // PUBLIC

// EVERYTHING BELOW REQUIRES a valid admin. Roles: owner, content_admin, developer.
router.use(authAdmin);
router.use('/dashboard', dashboard);
router.use('/replays', requireRole('owner', 'content_admin'), replays);
router.use('/training', requireRole('owner', 'content_admin'), training);
router.use('/lessons', requireRole('owner', 'content_admin'), lessons);
router.use('/videos', requireRole('owner', 'content_admin'), videos);
router.use('/resources', requireRole('owner', 'content_admin'), resources);
router.use('/clients', requireRole('owner', 'content_admin', 'developer'), clients);
router.use('/provisioning', requireRole('owner', 'developer'), provisioning);
router.use('/structure', requireRole('owner'), structure);
router.use('/team', requireRole('owner'), team);
router.use('/settings', requireRole('owner'), settings);
router.use('/reports', requireRole('owner', 'content_admin'), reports);
router.use('/audit', requireRole('owner', 'developer'), audit);

export default router;
