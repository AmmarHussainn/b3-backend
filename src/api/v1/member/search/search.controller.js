import { search } from '../../../../services/content.service.js';
import { ok } from '../../../../utils/response.js';
export const get = async (req, res) => ok(res, await search(req.valid.query.q, req.entitlements, req.valid.query.limit));
