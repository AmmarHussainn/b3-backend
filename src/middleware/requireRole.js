import { ApiError } from '../utils/ApiError.js';

/** requireRole('owner', 'content_admin'): must run after authAdmin. Role always comes from the DB. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.admin) return next(ApiError.unauthorized());
  if (!roles.includes(req.admin.role)) return next(ApiError.forbidden('Your role cannot do that'));
  next();
};
