import { asyncHandler } from '../utils/asyncHandler.js';
import { resolveEntitlements } from '../services/entitlement.service.js';

/** After authMember. Sets req.entitlements = { productIds, canSeeDrafts }. Every content query filters by it. */
export const loadEntitlements = asyncHandler(async (req, _res, next) => {
  req.entitlements = await resolveEntitlements(req.user.tags);
  next();
});
