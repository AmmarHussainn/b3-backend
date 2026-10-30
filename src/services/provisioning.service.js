// grant / revoke / update from HubSpot. Idempotent: the same event twice = one account, one welcome email.
import { User, HubspotEvent } from '../db/models/index.js';
import { TAGS, TIERS, TIER_TAGS, USER_STATUS as US, SYNC_ACTIONS as A, SYNC_STATUS as S, TAG_FORMAT } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { isoDate } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { normalizePayload } from '../integrations/hubspot/events.js';
import { enqueue, PermanentError } from '../jobs/queue.js';
import * as tokens from './token.service.js';
import * as email from './email.service.js';
import * as audit from './audit.service.js';
import * as entitlement from './entitlement.service.js';
import * as settings from './settings.service.js';

const DERIVED_WINDOW_MS = 10 * 60e3; // events without an explicit id are "duplicates" only inside this window

export function nextTags(existing = [], { add = [], remove = [] } = {}) {
  const set = new Set(existing);
  remove.forEach((t) => set.delete(t));
  add.forEach((t) => { if (!TAG_FORMAT.test(t)) throw new Error(`Bad tag ${t}`); set.add(t); });
  return [...set];
}
export function tierToTag(tier) {
  if (!tier) return null;
  const tag = TIERS[tier] ?? (TIER_TAGS.includes(tier) ? tier : null);
  if (!tag) throw ApiError.validation(`Unknown service tier "${tier}"`, { tier: [`Expected one of: ${Object.keys(TIERS).join(' | ')}`] });
  return tag;
}
const snap = (u) => (u ? { status: u.status, tags: [...(u.tags || [])], tier: u.tier } : null);
const syncBack = (user, status, message, extra = {}) =>
  enqueue('writeback', { hubspotContactId: user.hubspotContactId, email: user.email, status, message, ...extra });

async function upsertUser(emailAddr) {
  let user = await User.findOne({ email: emailAddr });
  if (user) return { user, created: false };
  try { return { user: await User.create({ email: emailAddr }), created: true }; } catch (e) {
    if (e.code !== 11000) throw e; // lost a race with a parallel identical event: use the winner's account
    return { user: await User.findOne({ email: emailAddr }), created: false };
  }
}

/** Claim-then-send so two parallel callers can never both send the welcome email. */
export async function sendWelcomeEmail(userId, { force = false } = {}) {
  const filter = force ? { _id: userId } : { _id: userId, welcomeEmailSentAt: null };
  const prev = await User.findOneAndUpdate(filter, { $set: { welcomeEmailSentAt: new Date() } }, { new: false });
  if (!prev) return 'already-sent';
  try {
    const raw = await tokens.issueInvite(userId, 'member');
    await email.sendWelcome(prev, raw);
    return 'sent';
  } catch (e) {
    await User.updateOne({ _id: userId }, prev.welcomeEmailSentAt ? { $set: { welcomeEmailSentAt: prev.welcomeEmailSentAt } } : { $unset: { welcomeEmailSentAt: 1 } });
    throw e;
  }
}

export async function grant(input, { suppressEmail = false, writeback = true, actor = audit.SYSTEM } = {}) {
  const addr = String(input.email).toLowerCase().trim();
  const tierTag = tierToTag(input.tier);
  const { user, created } = await upsertUser(addr);
  const before = snap(user);
  if (input.firstName) user.firstName = input.firstName;
  if (input.lastName) user.lastName = input.lastName;
  if (input.company) user.company = input.company;
  if (input.hubspotContactId) user.hubspotContactId = String(input.hubspotContactId);
  if (tierTag) user.tier = tierTag;
  user.tags = nextTags(user.tags, { add: [TAGS.PORTAL_ACCESS_ACTIVE, ...(tierTag ? [tierTag] : [])], remove: tierTag ? TIER_TAGS.filter((t) => t !== tierTag) : [] });
  user.status = US.ACTIVE;
  user.revokedAt = undefined;
  if (!user.provisionedAt) { const d = input.startDate ? new Date(input.startDate) : null; user.provisionedAt = d && !isNaN(d) ? d : new Date(); }
  await user.save();
  entitlement.invalidate(user._id);

  let welcome = 'skipped';
  if (!suppressEmail && !user.passwordHash) welcome = await sendWelcomeEmail(user._id);
  await audit.log({ actor, action: 'provisioning.grant', entity: 'user', entityId: user._id, before, after: { ...snap(user), welcome, created } });
  if (writeback) await syncBack(user, S.PROVISIONED, `Portal access granted${created ? ' (new account)' : ''}${welcome === 'sent' ? ', welcome email sent' : ''}`, { provisionedDate: isoDate(user.provisionedAt) });
  return { user, created, welcome };
}

export async function revoke(input, { status = US.REMOVED, writeback = true, actor = audit.SYSTEM } = {}) {
  const user = input.email ? await User.findOne({ email: String(input.email).toLowerCase() }) : input.hubspotContactId ? await User.findOne({ hubspotContactId: String(input.hubspotContactId) }) : null;
  if (!user) return { user: null, changed: false };
  const before = snap(user);
  const wasActive = user.status === US.ACTIVE;
  user.status = status === US.SUSPENDED ? US.SUSPENDED : US.REMOVED;
  user.tags = nextTags(user.tags, { remove: [TAGS.PORTAL_ACCESS_ACTIVE, TAGS.PORTAL_COMP] });
  if (wasActive || !user.revokedAt) user.revokedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1; // every issued access token dies now
  await user.save(); // account and progress are kept
  await tokens.revokeAll(user._id, 'member');
  entitlement.invalidate(user._id);
  if (wasActive && (await settings.get('sendAccessEndedEmail'))) await email.sendAccessEnded(user).catch((e) => logger.warn({ err: e }, 'access-ended email failed'));
  await audit.log({ actor, action: 'provisioning.revoke', entity: 'user', entityId: user._id, before, after: snap(user) });
  if (writeback) await syncBack(user, S.REVOKED, `Portal access removed (${user.status})`, { revokedDate: isoDate(user.revokedAt) });
  return { user, changed: wasActive };
}

export async function updateTier(input, { writeback = true, actor = audit.SYSTEM } = {}) {
  const user = await User.findOne({ email: String(input.email).toLowerCase() });
  if (!user) throw ApiError.notFound(`No portal account for ${input.email}`);
  const tierTag = tierToTag(input.tier);
  if (!tierTag) throw ApiError.validation('tier is required for an update');
  const before = snap(user);
  user.tier = tierTag;
  user.tags = nextTags(user.tags, { add: [tierTag], remove: TIER_TAGS.filter((t) => t !== tierTag) }); // portal-access-active untouched
  if (input.hubspotContactId && !user.hubspotContactId) user.hubspotContactId = String(input.hubspotContactId);
  await user.save();
  entitlement.invalidate(user._id);
  await audit.log({ actor, action: 'provisioning.update-tier', entity: 'user', entityId: user._id, before, after: snap(user) });
  if (writeback) await syncBack(user, user.status === US.ACTIVE ? S.PROVISIONED : S.REVOKED, `Tier updated to ${tierTag}`);
  return { user };
}

/** Admin: complimentary / exception access by hand (tag portal-comp). */
export async function grantComp({ email: addr, firstName, lastName, sendWelcome = true }, actor) {
  const { user, created } = await upsertUser(String(addr).toLowerCase().trim());
  const before = snap(user);
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  user.tags = nextTags(user.tags, { add: [TAGS.PORTAL_COMP] });
  user.status = US.ACTIVE;
  user.revokedAt = undefined;
  if (!user.provisionedAt) user.provisionedAt = new Date();
  await user.save();
  entitlement.invalidate(user._id);
  const welcome = sendWelcome && !user.passwordHash ? await sendWelcomeEmail(user._id) : 'skipped';
  await audit.log({ actor, action: 'client.grant-comp', entity: 'user', entityId: user._id, before, after: { ...snap(user), welcome, created } });
  return { user, created, welcome };
}

// ---------------- webhook intake + queue processing ----------------
/** Store, de-duplicate, queue, return fast. Called by the HubSpot webhook controller. */
export async function receiveEvent(body) {
  const p = normalizePayload(body);
  try {
    await HubspotEvent.create({ eventId: p.eventId, action: p.action, email: p.email, hubspotContactId: p.hubspotContactId, payload: p, status: 'received' });
  } catch (e) {
    if (e.code !== 11000) throw e;
    const existing = await HubspotEvent.findOne({ eventId: p.eventId });
    const derived = p.eventId.startsWith('derived:');
    const stale = derived && existing && Date.now() - existing.updatedAt.getTime() > DERIVED_WINDOW_MS;
    if (!stale) return { eventId: p.eventId, duplicate: true };
    await HubspotEvent.updateOne({ eventId: p.eventId }, { $set: { status: 'received', attempts: 0, payload: p }, $unset: { error: 1, processedAt: 1 } }); // a genuinely new, identical-looking event
  }
  await enqueue('provision', { eventId: p.eventId });
  return { eventId: p.eventId, duplicate: false };
}

export async function processEvent(eventId) {
  const ev = await HubspotEvent.findOneAndUpdate({ eventId, status: { $in: ['received', 'processing', 'failed'] } }, { $set: { status: 'processing' }, $inc: { attempts: 1 } }, { new: true });
  if (!ev) return { skipped: true }; // already done: duplicate delivery changes nothing
  const p = ev.payload;
  try {
    if (ev.action === A.GRANT) await grant(p);
    else if (ev.action === A.REVOKE) await revoke(p, { status: p.revokeStatus });
    else await updateTier(p);
    await HubspotEvent.updateOne({ _id: ev._id }, { $set: { status: 'done', processedAt: new Date() }, $unset: { error: 1 } });
    return { ok: true };
  } catch (e) {
    await HubspotEvent.updateOne({ _id: ev._id }, { $set: { error: e.message } });
    if (e instanceof ApiError && e.status < 500) throw new PermanentError(e.message); // bad data: do not retry
    throw e; // upstream/infra: queue retries with backoff
  }
}

/** Retries exhausted: mark failed and tell HubSpot (workflow 4 turns Error into a task). */
export async function failEvent(eventId, err) {
  const ev = await HubspotEvent.findOneAndUpdate({ eventId }, { $set: { status: 'failed', error: String(err?.message || err).slice(0, 500) } }, { new: true });
  if (!ev) return;
  await audit.log({ action: 'provisioning.failed', entity: 'hubspotEvent', entityId: ev._id, after: { eventId, error: ev.error } });
  await enqueue('writeback', { hubspotContactId: ev.hubspotContactId, email: ev.email, status: S.ERROR, message: `Provisioning failed: ${ev.error}` });
}

export async function retryEvent(id, actor) {
  const ev = await HubspotEvent.findById(id);
  if (!ev) throw ApiError.notFound('Event not found');
  await HubspotEvent.updateOne({ _id: id }, { $set: { status: 'received', attempts: 0 }, $unset: { error: 1 } });
  await audit.log({ actor, action: 'provisioning.retry', entity: 'hubspotEvent', entityId: id });
  await enqueue('provision', { eventId: ev.eventId });
  return { eventId: ev.eventId };
}
