import { connectDB, disconnectDB } from '../connection.js';
import { Product, Offer } from '../models/index.js';
import { products } from './data/products.js';
import { offers } from './data/offers.js';
import { logger } from '../../utils/logger.js';

// Idempotent: safe to re-run. Upserts by key.
await connectDB();

for (const p of products) await Product.updateOne({ key: p.key }, { $set: p }, { upsert: true });
const all = await Product.find().select('_id key').lean();
const byKey = Object.fromEntries(all.map((p) => [p.key, p._id]));

for (const o of offers) {
  const { productKeys, ...rest } = o;
  const productIds = productKeys ? productKeys.map((k) => byKey[k]) : all.map((p) => p._id);
  await Offer.updateOne({ key: o.key }, { $set: { ...rest, productIds } }, { upsert: true });
}

logger.info({ products: products.length, offers: offers.length }, 'Seed complete');
await disconnectDB();
