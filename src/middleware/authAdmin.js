import { AdminUser } from '../db/models/index.js';
import { verifyAdmin } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES as C } from '../config/constants.js';
import { bearer } from './authMember.js';
import { actorOf } from './auditLog.js';

/** STRICT: separate keys + audience from members; role is read from the DB, never from the token. */
export async function authAdmin(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) throw ApiError.unauthorized();
    const payload = verifyAdmin(token);
    const a = await AdminUser.findById(payload.sub).lean();
    if (!a || !a.active || a.tokenVersion !== payload.tv) throw new ApiError(C.TOKEN_INVALID, 'Session is no longer valid');
    req.admin = { id: String(a._id), email: a.email, role: a.role, firstName: a.firstName, lastName: a.lastName };
    req.actor = actorOf(req);
    next();
  } catch (e) { next(e); }
}
