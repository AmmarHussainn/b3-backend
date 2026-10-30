// Admin dashboard: what needs attention right now.
import { User, Lesson, Product, HubspotEvent, AuditLog } from '../db/models/index.js';
import { USER_STATUS as US, PRODUCT_KEYS, CONTENT_STATUS as CS } from '../config/constants.js';
import { publishDeadline, hoursBetween } from '../utils/dates.js';

export async function overview() {
  const replays = await Product.findOne({ key: PRODUCT_KEYS.GROWTH_LAB_REPLAYS }).lean();
  const [activeClients, failed, pending, draftLessons, draftReplays, lastReplay, recentDrafts] = await Promise.all([
    User.countDocuments({ status: US.ACTIVE }),
    HubspotEvent.countDocuments({ status: 'failed' }),
    HubspotEvent.countDocuments({ status: { $in: ['received', 'processing'] } }),
    Lesson.countDocuments({ status: CS.DRAFT, ...(replays ? { productId: { $ne: replays._id } } : {}) }),
    replays ? Lesson.countDocuments({ status: CS.DRAFT, productId: replays._id }) : 0,
    replays ? Lesson.findOne({ productId: replays._id, status: CS.LIVE }).sort({ sessionDate: -1 }).select('title sessionDate publishedAt').lean() : null,
    replays ? Lesson.find({ productId: replays._id, status: CS.DRAFT, sessionDate: { $gte: new Date(Date.now() - 14 * 864e5) } }).select('title sessionDate').lean() : [],
  ]);
  // 48-hour publishing standard: live by end of Friday for a Wednesday session
  const publishing = recentDrafts.map((l) => {
    const left = hoursBetween(new Date(), publishDeadline(l.sessionDate));
    return { id: String(l._id), title: l.title, sessionDate: l.sessionDate, deadline: publishDeadline(l.sessionDate), hoursRemaining: Math.round(left), state: left < 0 ? 'overdue' : left < 24 ? 'at-risk' : 'on-track' };
  });
  return { activeClients, sync: { failed, pending }, drafts: { lessons: draftLessons, replays: draftReplays }, lastReplay, publishing };
}

// ---------------- activity feed: GET /v1/admin/dashboard/activity ----------------
const VERBS = {
  'lesson.create': 'created a lesson', 'lesson.update': 'edited a lesson', 'lesson.publish': 'published a lesson', 'lesson.unpublish': 'unpublished a lesson',
  'lesson.archive': 'archived a lesson', 'lesson.restore': 'restored a lesson', 'lesson.remove': 'removed a lesson',
  'lesson.caption-add': 'added captions', 'lesson.caption-remove': 'removed captions',
  'replay.create': 'created a replay', 'replay.update': 'edited a replay',
  'course.create': 'created a course', 'course.update': 'edited a course', 'course.publish': 'published a course', 'course.unpublish': 'unpublished a course',
  'course.archive': 'archived a course', 'course.restore': 'restored a course', 'course.remove': 'removed a course', 'course.move': 'moved a course', 'course.reorder': 'reordered lessons',
  'container.create': 'created a container', 'container.remove': 'removed a container', 'structure.update-product': 'edited a container',
  'resource.create': 'uploaded a resource', 'resource.replace': 'replaced a resource file', 'resource.rollback': 'rolled back a resource', 'resource.update': 'edited a resource', 'resource.remove': 'removed a resource',
  'video.create': 'started a video upload', 'video.replace-start': 'started a video replacement', 'video.delete': 'deleted a video',
  'client.grant-comp': 'granted complimentary access', 'client.resend-welcome': 'resent a welcome email',
  'provisioning.grant': 'granted portal access', 'provisioning.revoke': 'removed portal access', 'provisioning.update-tier': 'updated a client tier',
  'provisioning.failed': 'sync failed', 'provisioning.retry': 'retried a failed sync', 'reconcile.run': 'ran a reconcile', 'reconcile.one': 'reconciled a client',
  'bulk.load': 'ran a bulk client import', 'bulk.send-welcome': 'sent the welcome email batch',
  'team.invite': 'invited a team member', 'team.update': 'changed a team member', 'team.resend-invite': 'resent a team invite', 'settings.update': 'changed a setting',
};
const severityOf = (a) => (a === 'provisioning.failed' ? 'error' : /(revoke|remove|delete)/.test(a) ? 'warning' : 'info');

/** Recent operational events from the audit log (logins and email deliveries are left out as noise). `before` = ISO date cursor. */
export async function activity({ limit = 20, before } = {}) {
  const f = { $nor: [{ action: /^email\./ }, { action: /\.login$/ }] };
  if (before) f.at = { $lt: new Date(before) };
  const rows = await AuditLog.find(f).sort({ at: -1 }).limit(limit).lean();
  const items = rows.map((a) => {
    const who = a.actorEmail || (a.actorType === 'system' ? 'System' : a.actorType);
    const title = a.after?.title || a.after?.fileName || a.after?.email || a.after?.error || null;
    const verb = VERBS[a.action] || a.action.replace(/[._-]/g, ' ');
    return { id: String(a._id), at: a.at, severity: severityOf(a.action), actorType: a.actorType, actor: who, action: a.action, entity: a.entity || null, entityId: a.entityId || null, title, summary: `${who} ${verb}${title ? `: ${title}` : ''}` };
  });
  return { items, nextBefore: items.length === limit ? items[items.length - 1].at : null };
}
