// Read-only view of how access is wired: products, offers, tag map. (Editing offers is a FUTURE admin feature.)
import { Product, Category, Lesson, Offer } from '../db/models/index.js';
import { TAGS, TIER_TAGS, CONTENT_STATUS as CS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import * as entitlement from './entitlement.service.js';
import * as audit from './audit.service.js';

const RESERVED = new Set([TAGS.PORTAL_TEAM_SEAT, TAGS.INDUSTRY_LEGAL, TAGS.INDUSTRY_MEDICAL]);

export async function overview() {
  const [products, offers, catCounts, lessonCounts] = await Promise.all([
    Product.find().sort({ order: 1 }).lean(),
    Offer.find().lean(),
    Category.aggregate([{ $match: { status: { $ne: CS.REMOVED } } }, { $group: { _id: '$productId', n: { $sum: 1 } } }]),
    Lesson.aggregate([{ $match: { status: { $ne: CS.REMOVED } } }, { $group: { _id: '$productId', n: { $sum: 1 } } }]),
  ]);
  const cc = new Map(catCounts.map((r) => [String(r._id), r.n])); const lc = new Map(lessonCounts.map((r) => [String(r._id), r.n]));
  const flat = await Category.find({ slug: 'general', productId: { $in: products.filter((p) => p.presentation === 'flat').map((p) => p._id) } }).lean();
  const holder = new Map(flat.map((c) => [String(c.productId), String(c._id)]));
  const keyOf = new Map(products.map((p) => [String(p._id), p.key]));
  const tagMap = Object.values(TAGS).map((tag) => {
    const grants = offers.filter((o) => (o.grantedByTags || []).includes(tag)).map((o) => o.key);
    return { tag, grantsOffers: grants, purpose: grants.length ? 'grants access' : RESERVED.has(tag) ? 'reserved (future)' : TIER_TAGS.includes(tag) ? 'data only (tier)' : 'none' };
  });
  return {
    products: products.map((p) => ({ id: String(p._id), key: p.key, title: p.title, presentation: p.presentation, navGroup: p.navGroup, status: p.status, order: p.order, defaultCategoryId: holder.get(String(p._id)) || null, categories: cc.get(String(p._id)) || 0, lessons: lc.get(String(p._id)) || 0 })),
    offers: offers.map((o) => ({ id: String(o._id), key: o.key, title: o.title, active: o.active, includesUnpublished: o.includesUnpublished, grantedByTags: o.grantedByTags, products: o.productIds.map((id) => keyOf.get(String(id))).filter(Boolean) })),
    tagMap,
  };
}
export async function updateProduct(id, { title, navGroup, order, status }, actor) {
  const p = await Product.findById(id);
  if (!p) throw ApiError.notFound('Container not found');
  if (title && /\b(tier|premium|basic|executive|advisory only)\b/i.test(title)) throw ApiError.validation('Name containers by topic or audience, never by tier or price');
  const before = { title: p.title, navGroup: p.navGroup, order: p.order, status: p.status };
  Object.assign(p, Object.fromEntries(Object.entries({ title, navGroup, order, status }).filter(([, v]) => v !== undefined)));
  await p.save();
  entitlement.invalidateAll();
  await audit.log({ actor, action: 'structure.update-product', entity: 'product', entityId: id, before, after: { title: p.title, navGroup: p.navGroup, order: p.order, status: p.status } });
  return p;
}
