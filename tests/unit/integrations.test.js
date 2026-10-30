import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { normalizePayload } from '../../src/integrations/hubspot/events.js';
import { tusCredentials, mapStatus } from '../../src/integrations/bunny/stream.client.js';

describe('HubSpot payload', () => {
  it('accepts the flat handoff and derives a stable id', () => {
    const a = normalizePayload({ action: 'grant', email: 'A@X.com', first_name: 'Ann', tier: 'b3 Growth Lab', hubspot_contact_id: '9' });
    const b = normalizePayload({ action: 'grant', email: 'a@x.com', first_name: 'Ann', tier: 'b3 Growth Lab', hubspot_contact_id: '9' });
    expect(a.email).toBe('a@x.com'); expect(a.eventId).toBe(b.eventId); expect(a.eventId.startsWith('derived:')).toBe(true);
  });
  it('accepts the nested properties shape and explicit event ids', () => {
    const p = normalizePayload({ action: 'revoke', event_id: 'abc', properties: { email: { value: 'z@x.com' }, hs_object_id: { value: '5' } } });
    expect(p).toMatchObject({ email: 'z@x.com', hubspotContactId: '5', eventId: 'hs:abc' });
  });
  it('rejects bad payloads', () => { expect(() => normalizePayload({ action: 'explode', email: 'x' })).toThrow(); });
});
describe('Bunny', () => {
  it('signs TUS uploads as sha256(library + key + expire + video)', () => {
    const c = tusCredentials('vid-1');
    expect(c.headers.AuthorizationSignature).toBe(createHash('sha256').update(`12345api-key${c.headers.AuthorizationExpire}vid-1`).digest('hex'));
  });
  it('maps statuses', () => { expect(mapStatus(4)).toBe('ready'); expect(mapStatus(5)).toBe('failed'); expect(mapStatus(2)).toBe('processing'); expect(mapStatus(8)).toBeNull(); });
});
