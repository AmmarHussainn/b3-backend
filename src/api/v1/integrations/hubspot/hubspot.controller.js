import { receiveEvent } from '../../../../services/provisioning.service.js';
import { accepted } from '../../../../utils/response.js';
// Acknowledge fast. Work happens on the queue with retries; failures surface through HubSpot's b3_portal_sync_status.
export const receive = async (req, res) => accepted(res, await receiveEvent(req.valid.body));
