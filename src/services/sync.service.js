// Admin read models for the sync log (HubSpot events).
import { HubspotEvent } from '../db/models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { pageParams } from '../utils/pagination.js';

export async function status() {
  const [received, processing, failed, done, last] = await Promise.all(['received', 'processing', 'failed', 'done'].map((s) => HubspotEvent.countDocuments({ status: s })).concat(HubspotEvent.findOne({ status: 'done' }).sort({ processedAt: -1 }).select('processedAt').lean()));
  return { received, processing, failed, done, lastProcessedAt: last?.processedAt || null };
}
export async function listEvents(q = {}) {
  const { page, limit, skip } = pageParams(q);
  const f = {};
  if (q.status) f.status = q.status;
  if (q.action) f.action = q.action;
  if (q.email) f.email = q.email.toLowerCase();
  const [items, total] = await Promise.all([HubspotEvent.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), HubspotEvent.countDocuments(f)]);
  return { items, total, page, limit };
}
export async function getEvent(id) {
  const e = await HubspotEvent.findById(id).lean();
  if (!e) throw ApiError.notFound('Event not found');
  return e;
}
/** Failed events with no later successful event for the same email = still needs a human. */
export async function unresolvedErrors() {
  const failed = await HubspotEvent.find({ status: 'failed' }).sort({ updatedAt: -1 }).lean();
  const out = [];
  for (const e of failed) {
    const later = await HubspotEvent.exists({ email: e.email, status: 'done', processedAt: { $gt: e.updatedAt } });
    if (!later) out.push(e);
  }
  return out;
}
