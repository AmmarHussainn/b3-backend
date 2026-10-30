import { AdminUser } from '../db/models/index.js';
import { ADMIN_ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import * as tokens from './token.service.js';
import * as email from './email.service.js';
import * as audit from './audit.service.js';

const pub = (a) => ({ id: String(a._id), email: a.email, firstName: a.firstName, lastName: a.lastName, role: a.role, active: a.active, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt });
async function otherActiveOwners(id) { return AdminUser.countDocuments({ _id: { $ne: id }, role: ADMIN_ROLES.OWNER, active: true }); }

export async function list() { return (await AdminUser.find().sort({ createdAt: 1 }).lean()).map(pub); }

export async function invite({ email: addr, firstName, lastName, role }, actor) {
  if (await AdminUser.exists({ email: addr })) throw ApiError.conflict('That email already has an admin account');
  const a = await AdminUser.create({ email: addr, firstName, lastName, role, active: true });
  const raw = await tokens.issueInvite(a._id, 'admin');
  await email.sendAdminInvite(a, raw);
  await audit.log({ actor, action: 'team.invite', entity: 'admin', entityId: a._id, after: { email: addr, role } });
  return pub(a);
}
export async function update(id, { role, active, firstName, lastName }, actor) {
  const a = await AdminUser.findById(id);
  if (!a) throw ApiError.notFound('Admin not found');
  const before = { role: a.role, active: a.active };
  const losingOwner = a.role === ADMIN_ROLES.OWNER && a.active && ((role && role !== ADMIN_ROLES.OWNER) || active === false);
  if (losingOwner && !(await otherActiveOwners(id))) throw ApiError.conflict('There must always be at least one active owner');
  if (String(actor.id) === String(id) && (active === false || (role && role !== a.role))) throw ApiError.conflict('You cannot change your own role or deactivate yourself');
  if (role) a.role = role;
  if (active !== undefined) a.active = active;
  if (firstName !== undefined) a.firstName = firstName;
  if (lastName !== undefined) a.lastName = lastName;
  if (role || active === false) { a.tokenVersion = (a.tokenVersion || 0) + 1; await tokens.revokeAll(a._id, 'admin'); } // existing sessions end now
  await a.save();
  await audit.log({ actor, action: 'team.update', entity: 'admin', entityId: id, before, after: { role: a.role, active: a.active } });
  return pub(a);
}
export async function resendInvite(id, actor) {
  const a = await AdminUser.findById(id).select('+passwordHash');
  if (!a) throw ApiError.notFound('Admin not found');
  if (a.passwordHash) throw ApiError.conflict('This admin has already set a password. Use "Forgot password".');
  await email.sendAdminInvite(a, await tokens.issueInvite(a._id, 'admin'));
  await audit.log({ actor, action: 'team.resend-invite', entity: 'admin', entityId: id });
  return { sent: true };
}
