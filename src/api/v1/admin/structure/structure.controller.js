import * as structure from '../../../../services/structure.service.js';
import { ok } from '../../../../utils/response.js';
export const overview = async (req, res) => ok(res, await structure.overview());
export const updateProduct = async (req, res) => ok(res, await structure.updateProduct(req.valid.params.id, req.valid.body, req.actor));
