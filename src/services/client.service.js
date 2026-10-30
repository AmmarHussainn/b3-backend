// Admin: client list/detail and manual actions. HubSpot stays the source of truth for HubSpot-managed clients.
import { User, HubspotEvent, AuditLog, Progress } from '../db/models/index.js';
import { USER_STATUS as US, TAGS, SYNC_STATUS as S } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { pageParams } from '../utils/pagination.js';
import { setAccessValue } from '../integrations/hubspot/writeback.js';
import { HS_ACCESS } from '../integrations/hubspot/properties.js';
import { logger } from '../utils/logger.js';
import * as prov from './provisioning.service.js';
import * as reconcile from './reconcile.service.js';
import * as entitlement from './entitlement.service.js';
import * as audit from './audit.service.js';

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const deriveSync = (ev) => !ev ? null : ['received', 'processing'].includes(ev.status) ? S.PENDING : ev.status === 'failed' ? S.ERROR : ev.action === 'revoke' ? S.REVOKED : S.PROVISIONED;

async function latestEvents(emails) {
  const rows = await HubspotEvent.aggregate([...(emails ? [{ $match: { email: { $in: emails } } }] : []), { $sort: { updatedAt: -1 } }, { $group: { _id: '$email', ev: { $first: '$$ROOT' } } }]);
  return new Map(rows.map((r) => [r._id, r.ev]));
}
const dto = (u, ev) => ({
  id: String(u._id), email: u.email, firstName: u.firstName, lastName: u.lastName, company: u.company, status: u.status, tier: u.tier, tags: u.tags,
  hubspotContactId: u.hubspotContactId, provisionedAt: u.provisionedAt, revokedAt: u.revokedAt, lastLoginAt: u.lastLoginAt, passwordSet: u.passwordHash ? true : undefined,
  syncStatus: deriveSync(ev) ?? (u.tags?.includes(TAGS.PORTAL_COMP) ? 'Manual' : null), lastSyncError: ev?.status === 'failed' ? ev.error : undefined,
});

export async function list(q = {}) {
  const { page, limit, skip } = pageParams(q);
  const f = {};
  if (q.status) f.status = q.status;
  if (q.tier) f.tier = q.tier;
  if (q.tag) f.tags = q.tag;
  if (q.q) { const rx = new RegExp(esc(q.q), 'i'); f.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }, { company: rx }]; }
  if (q.syncStatus) {
    const all = await latestEvents();
    f.email = { $in: [...all].filter(([, ev]) => deriveSync(ev) === q.syncStatus).map(([e]) => e) };
  }
  const [users, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).select('+passwordHash').lean(), User.countDocuments(f)]);
  const evs = await latestEvents(users.map((u) => u.email));
  return { items: users.map((u) => dto(u, evs.get(u.email))), total, page, limit };
}

export async function get(id) {
  const u = await User.findById(id).select('+passwordHash').lean();
  if (!u) throw ApiError.notFound('Client not found');
  const [events, audits, completed, lastProgress] = await Promise.all([
    HubspotEvent.find({ email: u.email }).sort({ createdAt: -1 }).limit(25).lean(),
    AuditLog.find({ entity: 'user', entityId: String(u._id) }).sort({ at: -1 }).limit(50).lean(),
    Progress.countDocuments({ userId: u._id, completed: true }),
    Progress.findOne({ userId: u._id }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
  ]);
  return { ...dto(u, events[0]), timeline: { events, audit: audits }, engagement: { completedLessons: completed, lastActivityAt: lastProgress?.updatedAt || null } };
}

export const grantComp = (input, actor) => prov.grantComp(input, actor);

/** Revoke by hand. For a HubSpot-managed client we also set HubSpot to Removed, otherwise the next reconcile would put access back. */
export async function revokeClient(id, { status = US.REMOVED } = {}, actor) {
  const u = await User.findById(id);
  if (!u) throw ApiError.notFound('Client not found');
  let hubspot = 'not-linked';
  if (u.hubspotContactId) {
    try { await setAccessValue(u.hubspotContactId, status === US.SUSPENDED ? HS_ACCESS.SUSPENDED : HS_ACCESS.REMOVED); hubspot = 'updated'; } catch (e) { hubspot = `failed: ${e.message}`; logger.warn({ err: e.message }, 'could not update HubSpot access'); }
  }
  await prov.revoke({ email: u.email }, { status, actor });
  return { hubspot, client: await get(id) };
}

export async function resendWelcome(id, actor) {
  const u = await User.findById(id).lean();
  if (!u) throw ApiError.notFound('Client not found');
  if (u.status !== US.ACTIVE) throw ApiError.conflict('Only active clients can be sent login details');
  const r = await prov.sendWelcomeEmail(u._id, { force: true });
  await audit.log({ actor, action: 'client.resend-welcome', entity: 'user', entityId: id });
  return { result: r };
}

/** Push the portal's view of this client back to HubSpot (fixes a missing/failed write-back). */
export async function retryWriteback(id) {
  const u = await User.findById(id).lean();
  if (!u) throw ApiError.notFound('Client not found');
  const { enqueue } = await import('../jobs/queue.js');
  await enqueue('writeback', { hubspotContactId: u.hubspotContactId, email: u.email, status: u.status === US.ACTIVE ? S.PROVISIONED : S.REVOKED, message: 'Manual write-back', ...(u.provisionedAt ? { provisionedDate: u.provisionedAt.toISOString().slice(0, 10) } : {}) });
  return { queued: true };
}
export const reconcileClient = async (id, { dryRun = false } = {}, actor) => {
  const u = await User.findById(id).lean();
  if (!u) throw ApiError.notFound('Client not found');
  return reconcile.reconcileOne({ email: u.email, hubspotContactId: u.hubspotContactId }, { dryRun, actor });
};
export const dropEntitlementCache = (id) => entitlement.invalidate(id);
