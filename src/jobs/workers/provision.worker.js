import { registerWorker } from '../queue.js';
import { processEvent, failEvent } from '../../services/provisioning.service.js';

// Retries with exponential backoff (>= 3 attempts). On the final failure: event -> failed, HubSpot b3_portal_sync_status -> Error.
export const registerProvisionWorker = () => registerWorker('provision', ({ eventId }) => processEvent(eventId), {
  onFinalFailure: ({ eventId }, err) => failEvent(eventId, err),
});
