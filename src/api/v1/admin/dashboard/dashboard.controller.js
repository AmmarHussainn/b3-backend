import { overview, activity } from '../../../../services/dashboard.service.js';
import { ok } from '../../../../utils/response.js';

export const get = async (req, res) => ok(res, await overview());
export const getActivity = async (req, res) => ok(res, await activity(req.valid.query));
