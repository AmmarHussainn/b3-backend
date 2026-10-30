import { handleWebhook } from '../../../../services/video.service.js';
import { ok } from '../../../../utils/response.js';
export const receive = async (req, res) => ok(res, await handleWebhook(req.valid.body));
