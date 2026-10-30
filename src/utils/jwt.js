// RS256. Member and admin tokens use different keys AND different audiences.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ERROR_CODES as C } from '../config/constants.js';
import { ApiError } from './ApiError.js';

export const AUD = Object.freeze({ MEMBER: 'b3-member', ADMIN: 'b3-admin' });
const CFG = {
  member: { priv: env.JWT_MEMBER_PRIVATE_KEY, pub: env.JWT_MEMBER_PUBLIC_KEY, aud: AUD.MEMBER },
  admin: { priv: env.JWT_ADMIN_PRIVATE_KEY, pub: env.JWT_ADMIN_PUBLIC_KEY, aud: AUD.ADMIN },
};

function sign(kind, doc, extra = {}) {
  const c = CFG[kind];
  return jwt.sign({ tv: doc.tokenVersion || 0, ...extra }, c.priv, {
    algorithm: 'RS256', issuer: env.JWT_ISSUER, audience: c.aud,
    subject: String(doc._id || doc.id), expiresIn: env.ACCESS_TTL_SECONDS,
  });
}
function verify(kind, token) {
  const c = CFG[kind];
  try {
    return jwt.verify(token, c.pub, { algorithms: ['RS256'], issuer: env.JWT_ISSUER, audience: c.aud });
  } catch (e) {
    if (e.name === 'TokenExpiredError') throw new ApiError(C.TOKEN_EXPIRED, 'Access token expired');
    throw new ApiError(C.TOKEN_INVALID, 'Invalid token');
  }
}
export const signMember = (user) => sign('member', user);
export const signAdmin = (admin) => sign('admin', admin, { role: admin.role });
export const verifyMember = (t) => verify('member', t);
export const verifyAdmin = (t) => verify('admin', t);
