import { memberAuth } from '../../../../services/auth.service.js';
import { getSupportInfo } from '../../../../services/settings.service.js';
import { ok, noContent } from '../../../../utils/response.js';

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
export const login = async (req, res) => ok(res, await memberAuth.login(req.valid.body.email, req.valid.body.password, ctx(req)));
export const refresh = async (req, res) => ok(res, await memberAuth.refresh(req.valid.body.refreshToken, ctx(req)));
export const logout = async (req, res) => { await memberAuth.logout(req.valid.body.refreshToken); noContent(res); };
export const setPassword = async (req, res) => ok(res, await memberAuth.setPassword(req.valid.body.token, req.valid.body.password, ctx(req)));
export const forgot = async (req, res) => { await memberAuth.forgotPassword(req.valid.body.email, ctx(req)); ok(res, { message: 'If that email has a portal account, a reset link is on its way.' }); };
export const reset = async (req, res) => { await memberAuth.resetPassword(req.valid.body.token, req.valid.body.password); ok(res, { message: 'Password updated. Please sign in.' }); };
export const change = async (req, res) => ok(res, await memberAuth.changePassword(req.user.id, req.valid.body.currentPassword, req.valid.body.newPassword, ctx(req)));
export const linkStatus = async (req, res) => ok(res, { valid: await memberAuth.linkStatus(req.valid.body.token, req.valid.body.type) });
export const supportInfo = async (req, res) => ok(res, await getSupportInfo());
