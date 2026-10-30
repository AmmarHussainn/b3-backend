import { Setting } from '../db/models/index.js';

export const DEFAULTS = Object.freeze({
  supportEmail: 'kristi@consultb3.com',
  slackUrl: '',
  facebookGroupUrl: '',
  bookingLinks: [], // [{ label, url }]
  accessEndedMessage: 'Your access to the b3 Growth Portal has ended. If you think this is a mistake, or you would like to return, please contact the Consult b3 team.',
  sendAccessEndedEmail: false,
});
let cache = null;
let cacheAt = 0;

export async function getAll() {
  if (cache && Date.now() - cacheAt < 30_000) return cache;
  const rows = await Setting.find().lean();
  cache = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  cacheAt = Date.now();
  return cache;
}
export const get = async (key) => (await getAll())[key];
export async function set(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Unknown setting ${key}`);
  const before = (await getAll())[key];
  await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
  cache = null;
  return { before, after: value };
}
export async function getSupportInfo() {
  const s = await getAll();
  return { supportEmail: s.supportEmail, accessEndedMessage: s.accessEndedMessage, bookingLinks: s.bookingLinks };
}
export async function getMemberLinks() {
  const s = await getAll();
  return { supportEmail: s.supportEmail, slackUrl: s.slackUrl, facebookGroupUrl: s.facebookGroupUrl, bookingLinks: s.bookingLinks };
}
