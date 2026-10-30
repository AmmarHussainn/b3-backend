// Idempotent. Safe to re-run: uses $setOnInsert so it never overwrites changes made in the admin.
//   npm run seed                    -> Core container only (start with one; add Advanced later)
//   npm run seed -- --with-advanced -> also create the Advanced container
import { connectDb, disconnectDb } from '../connection.js';
import { Product, Category, Offer, Setting } from '../models/index.js';
import { PRODUCT_KEYS as K, CONTENT_STATUS as CS } from '../../config/constants.js';
import { DEFAULTS } from '../../services/settings.service.js';
import { PRODUCTS } from './data/products.js';
import { OFFERS } from './data/offers.js';

const withAdvanced = process.argv.includes('--with-advanced');
await connectDb();

const ids = {};
for (const { optional, ...p } of PRODUCTS) {
  if (optional && !withAdvanced) continue;
  const doc = await Product.findOneAndUpdate({ key: p.key }, { $setOnInsert: p }, { upsert: true, new: true });
  ids[p.key] = doc._id;
}
// Start Here is a flat list but Lesson.categoryId is required, so it gets one hidden holding category.
await Category.updateOne({ productId: ids[K.START_HERE], slug: 'general' }, { $setOnInsert: { kind: 'course', title: 'Start Here', description: 'Holding category for the flat Start Here lessons', order: 0, status: CS.LIVE } }, { upsert: true });

for (const o of OFFERS) {
  await Offer.updateOne({ key: o.key }, { $setOnInsert: { ...o, productIds: Object.values(ids), active: true } }, { upsert: true });
}
for (const [key, value] of Object.entries(DEFAULTS)) await Setting.updateOne({ key }, { $setOnInsert: { value } }, { upsert: true });

console.log(`Seeded ${Object.keys(ids).length} products, ${OFFERS.length} offers, ${Object.keys(DEFAULTS).length} settings.`);
await disconnectDb();
