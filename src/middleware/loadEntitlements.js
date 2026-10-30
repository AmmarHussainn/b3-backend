import { resolve } from '../services/entitlement.service.js';

/** req.entitlements = { productIds[], includesUnpublished, offerKeys[] }. Every content query uses it. */
export async function loadEntitlements(req, res, next) {
  try { req.entitlements = await resolve(req.user); next(); } catch (e) { next(e); }
}
