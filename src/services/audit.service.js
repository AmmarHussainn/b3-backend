import { AuditLog } from '../db/models/index.js';
import { logger } from '../utils/logger.js';
import { pageParams } from '../utils/pagination.js';

export const SYSTEM = Object.freeze({ type: 'system' });

/** Never throws: an audit failure must not break the action being audited. */
export async function log({ actor = SYSTEM, action, entity, entityId, before, after }) {
  try {
    await AuditLog.create({
      actorType: actor.type || 'system', actorId: actor.id, actorEmail: actor.email, ip: actor.ip,
      action, entity, entityId: entityId ? String(entityId) : undefined, before, after,
    });
  } catch (e) { logger.error({ err: e, action }, 'audit log write failed'); }
}

export async function list(q = {}) {
  const { page, limit, skip } = pageParams(q);
  const f = {};
  if (q.action) f.action = q.action;
  if (q.entity) f.entity = q.entity;
  if (q.entityId) f.entityId = q.entityId;
  if (q.actorEmail) f.actorEmail = q.actorEmail.toLowerCase();
  if (q.from || q.to) f.at = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  const [items, total] = await Promise.all([AuditLog.find(f).sort({ at: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(f)]);
  return { items, total, page, limit };
}
