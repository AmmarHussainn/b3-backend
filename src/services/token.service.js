// invite / reset / refresh tokens. Only SHA-256 hashes are stored.
import { AuthToken } from '../db/models/index.js';
import { TOKEN_TYPES as T, ERROR_CODES as C } from '../config/constants.js';
import { env } from '../config/env.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { ApiError } from '../utils/ApiError.js';

async function issueSingleUse(userId, userType, type, ttlMs, ctx = {}) {
  await AuthToken.deleteMany({ userId, userType, type, usedAt: null }); // older links stop working
  const raw = randomToken(32);
  await AuthToken.create({ userId, userType, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs), ip: ctx.ip, userAgent: ctx.userAgent });
  return raw;
}
export const issueInvite = (userId, userType = 'member', ctx) => issueSingleUse(userId, userType, T.INVITE, env.INVITE_TTL_HOURS * 3600e3, ctx);
export const issueReset = (userId, userType = 'member', ctx) => issueSingleUse(userId, userType, T.RESET, env.RESET_TTL_MINUTES * 60e3, ctx);

/** Atomically consume a single-use token. Throws LINK_EXPIRED when unknown, expired or already used. */
export async function consume(raw, type, userType = 'member') {
  const now = new Date();
  const doc = raw ? await AuthToken.findOneAndUpdate({ tokenHash: sha256(raw), type, userType, usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } }) : null;
  if (!doc) throw new ApiError(C.LINK_EXPIRED, 'This link has expired or was already used. Request a new one.');
  return doc;
}
export async function isValid(raw, type, userType = 'member') {
  if (!raw) return false;
  return Boolean(await AuthToken.exists({ tokenHash: sha256(raw), type, userType, usedAt: null, expiresAt: { $gt: new Date() } }));
}

// ---- refresh tokens: rotated on every use, reuse detection with a short grace window ----
export async function issueRefresh(userId, userType, { family, ctx = {} } = {}) {
  const raw = randomToken(48);
  const fam = family || randomToken(12);
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_SECONDS * 1000);
  await AuthToken.create({ userId, userType, type: T.REFRESH, tokenHash: sha256(raw), family: fam, expiresAt, ip: ctx.ip, userAgent: ctx.userAgent });
  return { raw, expiresAt, family: fam };
}

/**
 * Returns { userId, refresh, grace }.
 *  - normal: old token is marked used and a new one is returned in `refresh`
 *  - grace:  the same old token arrived again within REFRESH_REUSE_GRACE_SECONDS (parallel requests):
 *            `refresh` is null, the caller issues only a fresh access token and keeps its newer refresh cookie
 *  - reuse after the grace window: the whole token family is destroyed (assume theft)
 */
export async function rotateRefresh(raw, userType, ctx = {}) {
  const doc = raw ? await AuthToken.findOne({ tokenHash: sha256(raw), type: T.REFRESH, userType }) : null;
  if (!doc) throw new ApiError(C.TOKEN_INVALID, 'Invalid refresh token');
  if (doc.expiresAt <= new Date()) throw new ApiError(C.TOKEN_EXPIRED, 'Refresh token expired');
  if (doc.usedAt) {
    if ((Date.now() - doc.usedAt.getTime()) / 1000 <= env.REFRESH_REUSE_GRACE_SECONDS) return { userId: doc.userId, refresh: null, grace: true };
    await AuthToken.deleteMany({ family: doc.family });
    throw new ApiError(C.TOKEN_INVALID, 'Session revoked. Please sign in again.');
  }
  const claimed = await AuthToken.findOneAndUpdate({ _id: doc._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (!claimed) return { userId: doc.userId, refresh: null, grace: true }; // lost a race with a parallel request
  const next = await issueRefresh(doc.userId, userType, { family: doc.family, ctx });
  await AuthToken.updateOne({ _id: doc._id }, { $set: { replacedByHash: sha256(next.raw) } });
  return { userId: doc.userId, refresh: next, grace: false };
}
export async function revokeFamily(raw, userType) {
  const doc = raw ? await AuthToken.findOne({ tokenHash: sha256(raw), type: T.REFRESH, userType }) : null;
  if (doc) await AuthToken.deleteMany({ family: doc.family });
}
/** Revocation: kill every refresh/invite/reset token for a user. */
export const revokeAll = (userId, userType = 'member') => AuthToken.deleteMany({ userId, userType });
export const revokeRefreshTokens = (userId, userType = 'member') => AuthToken.deleteMany({ userId, userType, type: T.REFRESH });
