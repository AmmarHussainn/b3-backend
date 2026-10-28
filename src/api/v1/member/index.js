import { Router } from 'express';
import { authMember } from '../../../middleware/authMember.js';
import { loadEntitlements } from '../../../middleware/loadEntitlements.js';
import auth from './auth/auth.routes.js';
import me from './me/me.routes.js';
import dashboard from './dashboard/dashboard.routes.js';
import startHere from './start-here/start-here.routes.js';
import replays from './replays/replays.routes.js';
import training from './training/training.routes.js';
import lessons from './lessons/lessons.routes.js';
import resources from './resources/resources.routes.js';
import search from './search/search.routes.js';
import progress from './progress/progress.routes.js';

const router = Router();

// PUBLIC: login, refresh, set-password, forgot/reset. (change-password applies authMember inside its own route.)
router.use('/auth', auth);

// EVERYTHING BELOW REQUIRES a valid, active member. There is no unauthenticated way to reach content.
router.use(authMember, loadEntitlements);
router.use('/me', me);
router.use('/dashboard', dashboard);
router.use('/start-here', startHere);
router.use('/replays', replays);
router.use('/training', training);
router.use('/lessons', lessons);
router.use('/resources', resources);
router.use('/search', search);
router.use('/progress', progress);

export default router;
