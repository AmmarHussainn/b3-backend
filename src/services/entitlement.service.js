// THE permission layer: user tags -> offers (grantedByTags) -> union of product ids.
// Nothing in the codebase checks a tier name. Tier tags grant nothing until an offer lists them.
import { Offer } from '../db/models/index.js';
import { CONTENT_STATUS as CS, USER_STATUS } from '../config/constants.js';

const EMPTY = Object.freeze({ productIds: [], includesUnpublished: false, offerKeys: [] });
const cache = new Map(); // userId -> { at, value }
const TTL_MS = 60_000;

/** Pure: easy to unit test. `offers` are Offer documents (or plain objects). */
export function computeEntitlements(user, offers) {
  if (!user || user.status !== USER_STATUS.ACTIVE) return { ...EMPTY };
  const tags = new Set(user.tags || []);
  const matched = offers.filter((o) => o.active !== false && (o.grantedByTags || []).some((t) => tags.has(t)));
  const productIds = new Set();
  let includesUnpublished = false;
  for (const o of matched) {
    (o.productIds || []).forEach((id) => productIds.add(String(id)));
    if (o.includesUnpublished) includesUnpublished = true;
  }
  return { productIds: [...productIds], includesUnpublished, offerKeys: matched.map((o) => o.key) };
}

export async function resolve(user) {
  const id = String(user._id || user.id);
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const tags = user.tags || [];
  const offers = tags.length ? await Offer.find({ active: true, grantedByTags: { $in: tags } }).lean() : [];
  const value = computeEntitlements(user, offers);
  cache.set(id, { at: Date.now(), value });
  return value;
}
/** Call on grant, revoke, tier change, tag change. */
export const invalidate = (userId) => cache.delete(String(userId));
export const invalidateAll = () => cache.clear();

/** Statuses a member may see. Only the Staff offer sees drafts. `removed` is never visible. */
export const visibleStatuses = (ent) => (ent.includesUnpublished ? [CS.DRAFT, CS.LIVE, CS.ARCHIVED] : [CS.LIVE, CS.ARCHIVED]);
export const hasProduct = (ent, productId) => ent.productIds.includes(String(productId));
