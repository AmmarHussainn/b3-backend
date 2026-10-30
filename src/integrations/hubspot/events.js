// Parses the handoff payload (Technical Build Scope 6.3) into a normalized shape + stable event id.
import { z } from 'zod';
import { SYNC_ACTIONS } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { sha256 } from '../../utils/crypto.js';

/** HubSpot can send flat JSON, or { properties: { name: { value } } }, or { fields: {...} }. Accept all. */
function pick(body, ...names) {
  for (const n of names) {
    const cands = [body?.[n], body?.properties?.[n]?.value, body?.properties?.[n], body?.fields?.[n], body?.inputFields?.[n]];
    for (const v of cands) if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

const schema = z.object({
  action: z.enum(Object.values(SYNC_ACTIONS)),
  email: z.string().email().max(254),
});

export function normalizePayload(body = {}) {
  const base = schema.safeParse({ action: pick(body, 'action')?.toLowerCase(), email: pick(body, 'email', 'b3_portal_login_email')?.toLowerCase() });
  if (!base.success) throw ApiError.validation('Invalid handoff payload', base.error.flatten());
  const accessRaw = (pick(body, 'access', 'b3_portal_access') || '').toLowerCase();
  const out = {
    action: base.data.action,
    email: base.data.email,
    firstName: pick(body, 'first_name', 'firstname'),
    lastName: pick(body, 'last_name', 'lastname'),
    company: pick(body, 'company'),
    tier: pick(body, 'tier', 'b3_service_tier'),
    hubspotContactId: pick(body, 'hubspot_contact_id', 'hs_object_id', 'objectId', 'vid'),
    startDate: pick(body, 'start_date', 'b3_portal_provisioned_date'),
    revokeStatus: accessRaw === 'suspended' ? 'suspended' : 'removed',
  };
  const explicit = pick(body, 'event_id', 'eventId');
  out.eventId = explicit ? `hs:${explicit}` : deriveEventId(out);
  return out;
}

/** No event_id supplied: hash the meaningful fields. Treated as a duplicate only inside a short window (see provisioning.receiveEvent). */
export function deriveEventId(p) {
  return `derived:${sha256(JSON.stringify([p.action, p.email, p.tier || '', p.hubspotContactId || '', p.startDate || '', p.revokeStatus || '']))}`;
}
