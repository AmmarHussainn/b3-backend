import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { USER_STATUS } from '../config/constants.js';
import { User } from '../db/models/index.js';

export const bearer = (req) => {
  const h = req.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

/**
 * Strict member auth. Verifies the JWT AND re-checks the database on every request,
 * so Removed/Suspended takes effect immediately instead of when the token expires.
 * (BE-M3: add a <=60s in-memory cache here with explicit invalidation on revoke if load requires.)
 */
export const authMember = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw ApiError.unauthorized();

  const claims = await verifyAccessToken('member', token);
  const user = await User.findById(claims.sub).select('email firstName lastName status tags tier tokenVersion').lean();

  if (!user || user.tokenVersion !== claims.ver) throw ApiError.unauthorized();
  if (user.status !== USER_STATUS.ACTIVE) throw ApiError.accessEnded();

  req.user = user;
  next();
});
