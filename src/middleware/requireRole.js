import { ApiError } from '../utils/ApiError.js';

/** requireRole('owner', 'content_admin'). Must run after authAdmin. */
export const requireRole = (...roles) => (req, _res, next) =>
  req.admin && roles.includes(req.admin.role) ? next() : next(ApiError.forbidden());
