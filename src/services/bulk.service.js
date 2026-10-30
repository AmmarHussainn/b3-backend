// Launch-day batch (Technical Build Scope 7.2): load with welcome emails SUPPRESSED, verify, then send the batch on the agreed date.
import { User } from '../db/models/index.js';
import { TAGS, USER_STATUS as US, TIERS } from '../config/constants.js';
import { HS, HS_ACCESS } from '../integrations/hubspot/properties.js';
import { iterateAccessContacts } from '../integrations/hubspot/client.js';
import * as prov from './provisioning.service.js';
import * as audit from './audit.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const k = (r, ...names) => { for (const n of names) if (r[n] !== undefined && String(r[n]).trim() !== '') return String(r[n]).trim(); };

/** Accepts the keys of a HubSpot CSV export or of our own JSON. */
export function normalizeRow(r = {}) {
  const row = Object.fromEntries(Object.entries(r).map(([key, v]) => [key.toLowerCase().trim(), v]));
  return {
    email: (k(row, 'email', 'b3_portal_login_email', 'email address') || '').toLowerCase(),
    firstName: k(row, 'firstname', 'first_name', 'first name'),
    lastName: k(row, 'lastname', 'last_name', 'last name'),
    company: k(row, 'company', 'company name'),
    tier: k(row, 'tier', 'b3_service_tier', 'service tier'),
    hubspotContactId: k(row, 'hubspot_contact_id', 'record id', 'id'),
  };
}

export async function preview(rawRows) {
  const rows = rawRows.map(normalizeRow);
  const seen = new Set();
  const existing = new Map((await User.find({ email: { $in: rows.map((r) => r.email) } }).select('email status tags tier').lean()).map((u) => [u.email, u]));
  const out = rows.map((r, i) => {
    const problems = [];
    if (!EMAIL_RE.test(r.email)) problems.push('Invalid email');
    if (!r.tier) problems.push('Missing tier'); else if (!TIERS[r.tier]) problems.push(`Unknown tier "${r.tier}"`);
    if (seen.has(r.email)) problems.push('Duplicate email in file');
    seen.add(r.email);
    const u = existing.get(r.email);
    const action = problems.length ? 'invalid' : !u ? 'create' : u.status === US.ACTIVE && u.tags.includes(TAGS.PORTAL_ACCESS_ACTIVE) ? 'noop' : 'reactivate';
    return { row: i + 1, ...r, action, problems };
  });
  const count = (a) => out.filter((o) => o.action === a).length;
  return { summary: { total: out.length, create: count('create'), reactivate: count('reactivate'), noop: count('noop'), invalid: count('invalid') }, rows: out };
}

export async function load(rawRows, { dryRun = true, actor } = {}) {
  const pv = await preview(rawRows);
  if (dryRun) return { dryRun: true, ...pv };
  const results = [];
  for (const r of pv.rows) {
    if (r.action === 'invalid') { results.push({ email: r.email, ok: false, error: r.problems.join('; ') }); continue; }
    if (r.action === 'noop') { results.push({ email: r.email, ok: true, skipped: true }); continue; }
    try { await prov.grant(r, { suppressEmail: true, actor }); results.push({ email: r.email, ok: true }); } catch (e) { results.push({ email: r.email, ok: false, error: e.message }); }
  }
  await audit.log({ actor, action: 'bulk.load', after: { total: results.length, failed: results.filter((x) => !x.ok).length } });
  return { dryRun: false, summary: { ...pv.summary, loaded: results.filter((x) => x.ok && !x.skipped).length, failed: results.filter((x) => !x.ok).length }, results };
}

export async function rowsFromHubspot() {
  const rows = [];
  for await (const c of iterateAccessContacts()) {
    const p = c.properties || {};
    if (p[HS.ACCESS] !== HS_ACCESS.ACTIVE) continue;
    rows.push({ email: p[HS.LOGIN_EMAIL] || p.email, firstName: p.firstname, lastName: p.lastname, company: p.company, tier: p[HS.TIER], hubspotContactId: c.id });
  }
  return rows;
}

/** Send the welcome email to everyone who has not had one. `emails` restricts it (send to a test sample first). */
export async function sendWelcomeBatch({ emails, limit = 500, dryRun = true, actor } = {}) {
  const filter = { status: US.ACTIVE, tags: TAGS.PORTAL_ACCESS_ACTIVE, passwordHash: null, welcomeEmailSentAt: null };
  if (emails?.length) filter.email = { $in: emails.map((e) => e.toLowerCase()) };
  const users = await User.find(filter).select('email').limit(limit).lean();
  if (dryRun) return { dryRun: true, eligible: users.length, sample: users.slice(0, 10).map((u) => u.email) };
  let sent = 0; const failed = [];
  for (const u of users) {
    try { if ((await prov.sendWelcomeEmail(u._id)) === 'sent') sent++; } catch (e) { failed.push({ email: u.email, error: e.message }); }
    await new Promise((r) => setTimeout(r, 150)); // be gentle with the email provider
  }
  await audit.log({ actor, action: 'bulk.send-welcome', after: { sent, failed: failed.length } });
  return { dryRun: false, eligible: users.length, sent, failed };
}
