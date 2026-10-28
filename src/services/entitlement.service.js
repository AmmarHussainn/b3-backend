import { Offer } from '../db/models/index.js';

/**
 * THE permission layer: user tags -> offers (via grantedByTags) -> products.
 * At launch there is one client-facing offer containing every product. Tiering later =
 * add an offer with fewer products and change which tags grant it. No code change, no content moves.
 */
export async function resolveEntitlements(tags = []) {
  const offers = await Offer.find({ active: true, grantedByTags: { $in: tags } }).select('productIds includesUnpublished').lean();
  return {
    productIds: [...new Set(offers.flatMap((o) => o.productIds.map(String)))],
    canSeeDrafts: offers.some((o) => o.includesUnpublished),
  };
}

/** Mongo filter every member content query must include. */
export const entitledFilter = (ent) => ({
  productId: { $in: ent.productIds },
  status: ent.canSeeDrafts ? { $in: ['draft', 'live', 'archived'] } : { $in: ['live', 'archived'] },
});
