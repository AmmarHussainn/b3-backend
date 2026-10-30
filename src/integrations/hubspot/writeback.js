// Writes provisioning results back to HubSpot (Technical Build Scope 6.1/6.4).
import { logger } from '../../utils/logger.js';
import { findContactByEmail, hubspotConfigured, updateContact } from './client.js';
import { HS } from './properties.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * payload: { hubspotContactId?, email?, status, message?, provisionedDate?, revokedDate? }
 * status: 'Pending' | 'Provisioned' | 'Revoked' | 'Error'
 * Throws on HubSpot failure so the writeback worker retries.
 */
export async function writeback({ hubspotContactId, email, status, message = '', provisionedDate, revokedDate }) {
  if (!hubspotConfigured()) { logger.warn({ email, status }, 'HubSpot not configured: write-back skipped'); return { skipped: true }; }
  let id = hubspotContactId;
  if (!id && email) id = (await findContactByEmail(email))?.id;
  if (!id) { logger.info({ email, status }, 'No HubSpot contact found: write-back skipped'); return { skipped: true }; }
  const properties = { [HS.SYNC_STATUS]: status, [HS.SYNC_MESSAGE]: String(message).slice(0, 500) };
  if (provisionedDate) properties[HS.PROVISIONED_DATE] = provisionedDate === true ? today() : provisionedDate;
  if (revokedDate) properties[HS.REVOKED_DATE] = revokedDate === true ? today() : revokedDate;
  await updateContact(id, properties);
  return { ok: true, contactId: id };
}
export async function setAccessValue(hubspotContactId, value) {
  if (!hubspotConfigured() || !hubspotContactId) return { skipped: true };
  await updateContact(hubspotContactId, { [HS.ACCESS]: value });
  return { ok: true };
}
