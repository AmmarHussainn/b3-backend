import { Router } from 'express';
import { hubspotAuth } from '../../../middleware/hubspotAuth.js';
import { bunnyWebhookAuth } from '../../../middleware/bunnyWebhookAuth.js';
import hubspot from './hubspot/hubspot.routes.js';
import bunny from './bunny/bunny.routes.js';

const router = Router();

// No user sessions here. Each integration authenticates with its own secret.
router.use('/hubspot', hubspotAuth, hubspot);
router.use('/bunny', bunnyWebhookAuth, bunny);

export default router;
