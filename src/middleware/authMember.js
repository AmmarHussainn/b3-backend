import { User } from '../db/models/index.js';
import { USER_STATUS } from '../config/constants.js';
import { verifyMember } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES as C } from '../config/constants.js';
import * as settings from '../services/settings.service.js';

export function bearer(req) {
  const h = req.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** STRICT: verify RS256 token, then re-check the database on every request so Removed/Suspended is instant. */
export async function authMember(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) throw ApiError.unauthorized();
    const payload = verifyMember(token);
    const user = await User.findById(payload.sub).select('email firstName lastName company status tags tier hubspotContactId tokenVersion lastLoginAt').lean();
    if (!user || user.tokenVersion !== payload.tv) throw new ApiError(C.TOKEN_INVALID, 'Session is no longer valid');
    if (user.status !== USER_STATUS.ACTIVE) {
      const s = await settings.getSupportInfo();
      throw new ApiError(C.ACCESS_ENDED, s.accessEndedMessage, { supportEmail: s.supportEmail });
    }
    req.user = { ...user, id: String(user._id) };
    next();
  } catch (e) { next(e); }
}
