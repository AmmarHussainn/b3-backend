// One implementation for members and admins. No register function exists: accounts only come from HubSpot or an owner.
import { User, AdminUser } from '../db/models/index.js';
import { USER_STATUS, TOKEN_TYPES as T, ERROR_CODES as C } from '../config/constants.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { signMember, signAdmin } from '../utils/jwt.js';
import * as pw from '../utils/password.js';
import * as tokens from './token.service.js';
import * as email from './email.service.js';
import * as settings from './settings.service.js';
import * as audit from './audit.service.js';
import * as entitlement from './entitlement.service.js';
import { logger } from '../utils/logger.js';

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const invalid = () => new ApiError(C.INVALID_CREDENTIALS, 'Incorrect email or password');

function build(kind) {
  const isMember = kind === 'member';
  const Model = isMember ? User : AdminUser;
  const signer = isMember ? signMember : signAdmin;
  const isActive = (u) => (isMember ? u.status === USER_STATUS.ACTIVE : u.active);
  const pub = (u) => ({ id: String(u._id), email: u.email, firstName: u.firstName, lastName: u.lastName, ...(isMember ? { company: u.company } : { role: u.role }) });

  async function ended() {
    if (!isMember) return invalid();
    const s = await settings.getSupportInfo();
    return new ApiError(C.ACCESS_ENDED, s.accessEndedMessage, { supportEmail: s.supportEmail, bookingLinks: s.bookingLinks });
  }
  async function session(user, ctx) {
    const refresh = await tokens.issueRefresh(user._id, kind, { ctx });
    return { user: pub(user), accessToken: signer(user), expiresIn: env.ACCESS_TTL_SECONDS, refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt };
  }

  return {
    async login(email_, password, ctx = {}) {
      const user = await Model.findOne({ email: email_ }).select('+passwordHash');
      if (!user) { await pw.fakeVerify(password); throw invalid(); }
      if (user.lockedUntil && user.lockedUntil > new Date()) throw new ApiError(C.ACCOUNT_LOCKED, 'Too many failed attempts. Try again in a few minutes or reset your password.', { until: user.lockedUntil });
      if (!user.passwordHash) {
        if (!isActive(user)) throw await ended();
        throw new ApiError(C.PASSWORD_NOT_SET, 'Your password has not been set yet. Use the link in your welcome email, or choose "Forgot password".');
      }
      if (!(await pw.verify(user.passwordHash, password))) {
        const n = await Model.findOneAndUpdate({ _id: user._id }, { $inc: { failedLoginCount: 1 } }, { new: true });
        if (n.failedLoginCount >= LOCK_AFTER) await Model.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60e3), failedLoginCount: 0 } });
        throw invalid();
      }
      if (!isActive(user)) throw await ended(); // correct password but revoked: clear message, not a generic error
      await Model.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), failedLoginCount: 0 }, $unset: { lockedUntil: 1 } });
      await audit.log({ actor: { type: kind, id: user._id, email: user.email, ip: ctx.ip }, action: `${kind}.login`, entity: kind, entityId: user._id });
      return session(user, ctx);
    },

    async refresh(rawRefresh, ctx = {}) {
      const { userId, refresh, grace } = await tokens.rotateRefresh(rawRefresh, kind, ctx);
      const user = await Model.findById(userId);
      if (!user || !isActive(user)) { await tokens.revokeAll(userId, kind); throw await ended(); }
      return { accessToken: signer(user), expiresIn: env.ACCESS_TTL_SECONDS, refreshToken: refresh?.raw ?? null, refreshExpiresAt: refresh?.expiresAt ?? null, graceReuse: grace };
    },

    async logout(rawRefresh) { await tokens.revokeFamily(rawRefresh, kind); },

    /** Invite link: choose first password. Policy is checked BEFORE the token is consumed so a typo does not burn the link. */
    async setPassword(rawToken, password, ctx = {}) {
      pw.assertPolicy(password);
      const doc = await tokens.consume(rawToken, T.INVITE, kind);
      const user = await Model.findById(doc.userId).select('+passwordHash');
      if (!user || !isActive(user)) throw await ended();
      user.passwordHash = await pw.hash(password);
      user.failedLoginCount = 0;
      user.lastLoginAt = new Date();
      await user.save();
      await audit.log({ actor: { type: kind, id: user._id, email: user.email, ip: ctx.ip }, action: `${kind}.set-password`, entity: kind, entityId: user._id });
      return session(user, ctx);
    },

    /** Always resolves the same way whether or not the email exists. */
    async forgotPassword(email_, ctx = {}) {
      try {
        const user = await Model.findOne({ email: email_ });
        if (user && isActive(user)) {
          const raw = await tokens.issueReset(user._id, kind, ctx);
          await email.sendReset(user, raw, kind);
        }
      } catch (e) { logger.error({ err: e }, 'forgot-password failed (swallowed to avoid account enumeration)'); }
    },

    async resetPassword(rawToken, password) {
      pw.assertPolicy(password);
      const doc = await tokens.consume(rawToken, T.RESET, kind);
      const user = await Model.findById(doc.userId).select('+passwordHash');
      if (!user || !isActive(user)) throw await ended();
      user.passwordHash = await pw.hash(password);
      user.tokenVersion = (user.tokenVersion || 0) + 1; // kills every access token
      user.failedLoginCount = 0;
      user.lockedUntil = undefined;
      await user.save();
      await tokens.revokeRefreshTokens(user._id, kind);
      await audit.log({ actor: { type: kind, id: user._id, email: user.email }, action: `${kind}.reset-password`, entity: kind, entityId: user._id });
      if (isMember) entitlement.invalidate(user._id);
    },

    async changePassword(userId, current, next, ctx = {}) {
      const user = await Model.findById(userId).select('+passwordHash');
      if (!user || !user.passwordHash || !(await pw.verify(user.passwordHash, current))) throw new ApiError(C.INVALID_CREDENTIALS, 'Your current password is incorrect');
      pw.assertPolicy(next);
      user.passwordHash = await pw.hash(next);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      await tokens.revokeRefreshTokens(user._id, kind);
      await audit.log({ actor: { type: kind, id: user._id, email: user.email, ip: ctx.ip }, action: `${kind}.change-password`, entity: kind, entityId: user._id });
      return session(user, ctx); // fresh tokens so this session continues
    },

    linkStatus: (raw, type) => tokens.isValid(raw, type, kind),
  };
}

export const memberAuth = build('member');
export const adminAuth = build('admin');
