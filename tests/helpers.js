import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

let mongod;
export async function startDb() {
  mongod = await MongoMemoryServer.create();
  const { connectDb } = await import('../src/db/connection.js');
  await connectDb(mongod.getUri(), 'b3_test');
  const { startWorkers } = await import('../src/jobs/workers/index.js');
  startWorkers();
  const models = await import('../src/db/models/index.js');
  await Promise.all(Object.values(models).map((m) => m.init()));
}
export async function stopDb() {
  const { disconnectDb } = await import('../src/db/connection.js');
  await disconnectDb();
  await mongod?.stop();
}
export async function seedBasics() {
  const { Product, Category, Offer } = await import('../src/db/models/index.js');
  const { PRODUCTS } = await import('../src/db/seeds/data/products.js');
  const { OFFERS } = await import('../src/db/seeds/data/offers.js');
  const ids = {};
  for (const { optional, ...p } of PRODUCTS) ids[p.key] = (await Product.create(p))._id;
  await Category.create({ productId: ids['start-here'], slug: 'general', kind: 'course', title: 'Start Here', status: 'live' });
  for (const o of OFFERS) await Offer.create({ ...o, productIds: Object.values(ids) });
  return ids;
}
export const app = async () => request((await import('../src/app.js')).createApp());
export const hubspot = (agent, body, secret = 'test-webhook-secret') => agent.post('/v1/integrations/hubspot').set('x-webhook-secret', secret).send(body);
