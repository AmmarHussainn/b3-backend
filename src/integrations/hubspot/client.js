import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { HS, HS_CONTACT_PROPS } from './properties.js';

const BASE = 'https://api.hubapi.com';
export const hubspotConfigured = () => Boolean(env.HUBSPOT_ACCESS_TOKEN);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hs(path, { method = 'GET', body, attempt = 0 } = {}) {
  if (!env.HUBSPOT_ACCESS_TOKEN) throw ApiError.upstream('HubSpot is not configured (HUBSPOT_ACCESS_TOKEN missing)');
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method, signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw ApiError.upstream(`HubSpot request failed: ${e.message}`); }
  if (res.status === 429 && attempt < 3) { await sleep(1000 * (attempt + 1)); return hs(path, { method, body, attempt: attempt + 1 }); }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn({ path, status: res.status, text: text.slice(0, 300) }, 'HubSpot error');
    throw ApiError.upstream(`HubSpot responded ${res.status}`, { status: res.status });
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const getContact = (id, props = HS_CONTACT_PROPS) => hs(`/crm/v3/objects/contacts/${id}?properties=${props.join(',')}`);
export const updateContact = (id, properties) => hs(`/crm/v3/objects/contacts/${id}`, { method: 'PATCH', body: { properties } });

export async function findContactByEmail(email) {
  const r = await hs('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: { filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }], properties: HS_CONTACT_PROPS, limit: 1 },
  });
  return r?.results?.[0] || null;
}

/** One page of contacts that have b3_portal_access set. `modifiedSince` (Date) narrows to recent changes. */
export async function searchAccessContacts({ after, modifiedSince } = {}) {
  const filters = [{ propertyName: HS.ACCESS, operator: 'HAS_PROPERTY' }];
  if (modifiedSince) filters.push({ propertyName: 'lastmodifieddate', operator: 'GTE', value: String(modifiedSince.getTime()) });
  const r = await hs('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: { filterGroups: [{ filters }], properties: HS_CONTACT_PROPS, limit: 100, ...(after ? { after } : {}) },
  });
  return { results: r?.results || [], next: r?.paging?.next?.after || null };
}

/** Iterate every matching contact (respects HubSpot's search rate limit). */
export async function* iterateAccessContacts(opts = {}) {
  let after;
  do {
    const page = await searchAccessContacts({ ...opts, after });
    for (const c of page.results) yield c;
    after = page.next;
    if (after) await sleep(260);
  } while (after);
}
