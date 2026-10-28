import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { AdminUser } from '../db/models/index.js';
import { bearer } from './authMember.js';

/** Strict admin auth: separate keys, separate audience, role loaded fresh from the database. */
export const authAdmin = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw ApiError.unauthorized();

  const claims = await verifyAccessToken('admin', token);
  const admin = await AdminUser.findById(claims.sub).select('email firstName lastName role active tokenVersion').lean();

  if (!admin || !admin.active || admin.tokenVersion !== claims.ver) throw ApiError.unauthorized();

  req.admin = admin;
  next();
});
