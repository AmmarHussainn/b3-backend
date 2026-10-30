import { describe, it, expect } from 'vitest';
import { computeEntitlements } from '../../src/services/entitlement.service.js';

const offers = [
  { key: 'portal-all-access', grantedByTags: ['portal-access-active', 'portal-comp'], productIds: ['a', 'b', 'c'], includesUnpublished: false },
  { key: 'portal-staff', grantedByTags: ['portal-staff'], productIds: ['a', 'b', 'c'], includesUnpublished: true },
];
const user = (tags, status = 'active') => ({ status, tags });

describe('entitlement matrix', () => {
  it('active client sees everything, no drafts', () => expect(computeEntitlements(user(['portal-access-active', 'tier-growth-lab']), offers)).toMatchObject({ productIds: ['a', 'b', 'c'], includesUnpublished: false }));
  it('all three tiers are identical at launch', () => {
    const r = ['tier-growth-lab', 'tier-advisory', 'tier-executive'].map((t) => computeEntitlements(user(['portal-access-active', t]), offers));
    expect(r[0]).toEqual(r[1]); expect(r[1]).toEqual(r[2]);
  });
  it('a tier tag alone grants nothing', () => expect(computeEntitlements(user(['tier-advisory']), offers).productIds).toEqual([]));
  it('staff sees unpublished', () => expect(computeEntitlements(user(['portal-staff']), offers).includesUnpublished).toBe(true));
  it('comp tag grants the client offer', () => expect(computeEntitlements(user(['portal-comp']), offers).productIds).toHaveLength(3));
  it('removed / suspended users get nothing', () => { for (const s of ['removed', 'suspended']) expect(computeEntitlements(user(['portal-access-active'], s), offers).productIds).toEqual([]); });
  it('FUTURE: tiering is a settings change, not a rebuild', () => {
    // drop container "c" from the base offer and add a tier-gated offer: no code changes
    const tiered = [{ ...offers[0], productIds: ['a', 'b'] }, { key: 'adv', grantedByTags: ['tier-advisory', 'tier-executive'], productIds: ['c'] }, offers[1]];
    expect(computeEntitlements(user(['portal-access-active', 'tier-growth-lab']), tiered).productIds.sort()).toEqual(['a', 'b']);
    expect(computeEntitlements(user(['portal-access-active', 'tier-advisory']), tiered).productIds.sort()).toEqual(['a', 'b', 'c']);
  });
});
