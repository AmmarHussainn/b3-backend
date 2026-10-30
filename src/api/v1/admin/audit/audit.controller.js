import { list } from '../../../../services/audit.service.js';
import { paginated } from '../../../../utils/response.js';
export const get = async (req, res) => paginated(res, await list(req.valid.query));
