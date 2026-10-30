// Safety net: compare HubSpot b3_portal_access with portal users and fix drift in BOTH directions.
import { User, HubspotEvent } from '../db/models/index.js';
import { TAGS, USER_STATUS as US, SYNC_STATUS as S } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { HS, HS_ACCESS } from '../integrations/hubspot/properties.js';
import { hubspotConfigured, iterateAccessContacts, findContactByEmail, getContact } from '../integrations/hubspot/client.js';
import { enqueue } from '../jobs/queue.js';
import * as prov from './provisioning.service.js';
import * as audit from './audit.service.js';

const MAX_REVOKE_PCT = 0.2; // safety brake: refuse to mass-revoke on a bad HubSpot read

const toInput = (c) => {
  const p = c.properties || {};
  return {
    email: String(p[HS.LOGIN_EMAIL] || p.email || '').toLowerCase().trim(),
    firstName: p.firstname, lastName: p.lastname, company: p.company,
    tier: p[HS.TIER], hubspotContactId: c.id, access: p[HS.ACCESS],
  };
};
const holdsAccess = (u) => u.status === US.ACTIVE && (u.tags || []).includes(TAGS.PORTAL_ACCESS_ACTIVE);
const exempt = (u) => (u.tags || []).some((t) => t === TAGS.PORTAL_COMP || t === TAGS.PORTAL_STAFF);

/** What (if anything) must change for this contact/user pair? */
export function planFor(input, user) {
  if (!input.email) return [];
  if (input.access === HS_ACCESS.ACTIVE) {
    if (!user || !holdsAccess(user)) return [{ email: input.email, issue: user ? 'HubSpot Active, portal has no access' : 'HubSpot Active, no portal account', fix: 'grant', input }];
    let tierTag = null;
    try { tierTag = prov.tierToTag(input.tier); } catch { /* reported by grant */ }
    if (tierTag && user.tier !== tierTag) return [{ email: input.email, issue: 'Tier differs', fix: 'update', input }];
    return [];
  }
  if ([HS_ACCESS.REMOVED, HS_ACCESS.SUSPENDED].includes(input.access) && user && holdsAccess(user) && !exempt(user)) {
    return [{ email: input.email, issue: `HubSpot ${input.access}, portal still active`, fix: 'revoke', input: { ...input, revokeStatus: input.access === HS_ACCESS.SUSPENDED ? US.SUSPENDED : US.REMOVED } }];
  }
  return [];
}

async function apply(a) {
  if (a.fix === 'grant') return prov.grant(a.input);
  if (a.fix === 'update') return prov.updateTier(a.input);
  return prov.revoke(a.input, { status: a.input.revokeStatus });
}

export async function run({ full = false, dryRun = false, force = false } = {}) {
  if (!hubspotConfigured()) return { skipped: true, reason: 'HUBSPOT_ACCESS_TOKEN not set' };
  const report = { mode: full ? 'full' : 'incremental', dryRun, scanned: 0, planned: [], applied: 0, errors: [], staleFlagged: 0 };
  const users = await User.find().select('email status tags tier hubspotContactId').lean();
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const seenActive = new Set();
  const modifiedSince = full ? undefined : new Date(Date.now() - 45 * 60e3);

  let complete = true;
  try {
    for await (const c of iterateAccessContacts({ modifiedSince })) {
      report.scanned++;
      const input = toInput(c);
      if (input.access === HS_ACCESS.ACTIVE) seenActive.add(input.email);
      report.planned.push(...planFor(input, byEmail.get(input.email)));
    }
  } catch (e) { complete = false; report.errors.push(`HubSpot scan failed: ${e.message}`); }

  if (full && complete) { // direction 2: portal access that HubSpot no longer lists as Active
    for (const u of users) {
      if (holdsAccess(u) && !exempt(u) && !seenActive.has(u.email) && !report.planned.some((p) => p.email === u.email)) {
        report.planned.push({ email: u.email, issue: 'Portal active, not Active in HubSpot', fix: 'revoke', input: { email: u.email, revokeStatus: US.REMOVED } });
      }
    }
  }

  const revokes = report.planned.filter((p) => p.fix === 'revoke').length;
  const activeCount = users.filter(holdsAccess).length;
  if (revokes > Math.max(5, Math.ceil(activeCount * MAX_REVOKE_PCT)) && !force) {
    report.aborted = `Safety brake: ${revokes} revocations planned out of ${activeCount} active. Review with a dry run, then re-run with force.`;
    return report;
  }
  if (!dryRun) {
    for (const a of report.planned) {
      try { await apply(a); report.applied++; } catch (e) { report.errors.push(`${a.email}: ${e.message}`); }
    }
    await audit.log({ action: 'reconcile.run', after: { mode: report.mode, planned: report.planned.length, applied: report.applied, errors: report.errors.length } });
  }

  // Backstop for Workflow 4: anything still Pending after an hour becomes Error so HubSpot raises the task.
  const stale = await HubspotEvent.find({ status: { $in: ['received', 'processing'] }, updatedAt: { $lt: new Date(Date.now() - 3600e3) } }).lean();
  for (const ev of stale) {
    report.staleFlagged++;
    if (dryRun) continue;
    await HubspotEvent.updateOne({ _id: ev._id }, { $set: { status: 'failed', error: 'Still pending after 1 hour' } });
    await enqueue('writeback', { hubspotContactId: ev.hubspotContactId, email: ev.email, status: S.ERROR, message: 'Provisioning still pending after 1 hour' });
  }
  return report;
}

/** Force a reconcile for one contact (admin action). */
export async function reconcileOne({ email, hubspotContactId }, { dryRun = false, actor } = {}) {
  if (!hubspotConfigured()) throw ApiError.upstream('HubSpot is not configured');
  const c = hubspotContactId ? await getContact(hubspotContactId) : await findContactByEmail(email);
  if (!c) throw ApiError.notFound('No HubSpot contact found for that client');
  const input = toInput(c);
  const user = await User.findOne({ email: input.email }).select('email status tags tier hubspotContactId').lean();
  const plan = planFor(input, user);
  if (!dryRun) for (const a of plan) await apply(a);
  await audit.log({ actor, action: 'reconcile.one', entity: 'user', entityId: user?._id, after: { plan: plan.map((p) => p.fix), dryRun } });
  logger.info({ email: input.email, plan: plan.map((p) => p.fix) }, 'reconcileOne');
  return { hubspotAccess: input.access, plan: plan.map(({ email: e, issue, fix }) => ({ email: e, issue, fix })), applied: !dryRun };
}
