import { getDashboard } from '../../../../services/progress.service.js';
import { ok } from '../../../../utils/response.js';
export const get = async (req, res) => ok(res, await getDashboard(req.user, req.entitlements));
