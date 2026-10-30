import { User, Progress, Category, Lesson, AuditLog, Product } from '../db/models/index.js';
import { USER_STATUS as US, TIER_TAGS, CONTENT_STATUS as CS } from '../config/constants.js';
import { toCsv } from '../utils/csv.js';

const DAY = 864e5;

export async function engagement({ months = 6 } = {}) {
  const since = new Date(Date.now() - months * 31 * DAY);
  const active = await User.countDocuments({ status: US.ACTIVE });
  const [last30, last7, monthly, completion, byTier] = await Promise.all([
    User.countDocuments({ status: US.ACTIVE, lastLoginAt: { $gte: new Date(Date.now() - 30 * DAY) } }),
    User.countDocuments({ status: US.ACTIVE, lastLoginAt: { $gte: new Date(Date.now() - 7 * DAY) } }),
    AuditLog.aggregate([
      { $match: { action: 'member.login', at: { $gte: since } } },
      { $group: { _id: { y: { $year: '$at' }, m: { $month: '$at' }, u: '$actorId' }, logins: { $sum: 1 } } },
      { $group: { _id: { y: '$_id.y', m: '$_id.m' }, activeClients: { $sum: 1 }, logins: { $sum: '$logins' } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Progress.aggregate([
      { $match: { completed: true } },
      { $lookup: { from: 'lessons', localField: 'lessonId', foreignField: '_id', as: 'l' } }, { $unwind: '$l' },
      { $group: { _id: '$l.categoryId', completions: { $sum: 1 }, learners: { $addToSet: '$userId' } } },
    ]),
    User.aggregate([{ $match: { status: US.ACTIVE } }, { $group: { _id: '$tier', clients: { $sum: 1 }, loggedIn30: { $sum: { $cond: [{ $gte: ['$lastLoginAt', new Date(Date.now() - 30 * DAY)] }, 1, 0] } } } }]),
  ]);
  const cats = await Category.find({ _id: { $in: completion.map((c) => c._id) }, kind: 'course' }).select('title courseNumber').lean();
  const title = new Map(cats.map((c) => [String(c._id), c]));
  return {
    activeClients: active, loggedInLast30Days: last30, loggedInLast7Days: last7, monthlyActivePct: active ? Math.round((100 * last30) / active) : 0,
    monthly: monthly.map((m) => ({ month: `${m._id.y}-${String(m._id.m).padStart(2, '0')}`, activeClients: m.activeClients, logins: m.logins })),
    courseCompletion: completion.filter((c) => title.has(String(c._id))).map((c) => ({ courseId: String(c._id), title: title.get(String(c._id)).title, completions: c.completions, learners: c.learners.length })).sort((a, b) => b.completions - a.completions),
    byTier: byTier.map((t) => ({ tier: t._id, clients: t.clients, loggedInLast30Days: t.loggedIn30 })),
  };
}
export async function inactiveClients({ days = 30 } = {}) {
  const cutoff = new Date(Date.now() - days * DAY);
  return (await User.find({ status: US.ACTIVE, $or: [{ lastLoginAt: null }, { lastLoginAt: { $lt: cutoff } }] }).select('email firstName lastName company tier lastLoginAt provisionedAt').sort({ lastLoginAt: 1 }).lean())
    .map((u) => ({ id: String(u._id), email: u.email, name: [u.firstName, u.lastName].filter(Boolean).join(' '), company: u.company, tier: u.tier, lastLoginAt: u.lastLoginAt, neverLoggedIn: !u.lastLoginAt }));
}
/** Progress data export (also carries the HubSpot contact id so engagement can be reported against the CRM record). */
export async function exportRows() {
  const users = await User.find().sort({ email: 1 }).lean();
  const prog = await Progress.aggregate([{ $group: { _id: '$userId', completed: { $sum: { $cond: ['$completed', 1, 0] } }, lastActivityAt: { $max: '$updatedAt' } } }]);
  const pm = new Map(prog.map((p) => [String(p._id), p]));
  return users.map((u) => ({ email: u.email, firstName: u.firstName, lastName: u.lastName, company: u.company, status: u.status, tier: u.tier, hubspotContactId: u.hubspotContactId, provisionedAt: u.provisionedAt, revokedAt: u.revokedAt, lastLoginAt: u.lastLoginAt, completedLessons: pm.get(String(u._id))?.completed || 0, lastActivityAt: pm.get(String(u._id))?.lastActivityAt }));
}
export const EXPORT_COLUMNS = ['email', 'firstName', 'lastName', 'company', 'status', 'tier', 'hubspotContactId', 'provisionedAt', 'revokedAt', 'lastLoginAt', 'completedLessons', 'lastActivityAt'];
export const exportCsv = async () => toCsv(await exportRows(), EXPORT_COLUMNS);
export { TIER_TAGS };

// ---------------- GET /v1/admin/reports/completions ----------------
const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0); // one decimal

/**
 * Per course: how many active clients started it, finished it, and the average progress.
 * `lessons: true` adds the per-lesson ("module") breakdown. The welcome lesson (00) and non-live lessons are not counted.
 * Denominator = all active clients, because every client sees every course at launch.
 * (When tiering is switched on, change `eligible` to count only clients whose offers include that course's container.)
 */
export async function completions({ courseId, productId, lessons: withLessons = false } = {}) {
  const f = { kind: 'course', status: { $in: [CS.LIVE, CS.ARCHIVED] } };
  if (courseId) f._id = courseId;
  if (productId) f.productId = productId;
  const [courses, activeUsers] = await Promise.all([Category.find(f).sort({ courseNumber: 1 }).lean(), User.find({ status: US.ACTIVE }).select('_id').lean()]);
  const eligible = activeUsers.length;
  const [products, lessons] = await Promise.all([
    Product.find({ _id: { $in: courses.map((c) => c.productId) } }).select('title key').lean(),
    Lesson.find({ categoryId: { $in: courses.map((c) => c._id) }, status: CS.LIVE, number: { $gte: 1 } }).select('categoryId number title').sort({ number: 1 }).lean(),
  ]);
  const done = await Progress.find({ completed: true, lessonId: { $in: lessons.map((l) => l._id) }, userId: { $in: activeUsers.map((u) => u._id) } }).select('userId lessonId').lean();

  const catOf = new Map(lessons.map((l) => [String(l._id), String(l.categoryId)]));
  const perLesson = new Map(); // lessonId -> completions
  const perCourseUser = new Map(); // courseId -> Map(userId -> lessons completed)
  for (const d of done) {
    const lid = String(d.lessonId); const uid = String(d.userId); const cid = catOf.get(lid);
    perLesson.set(lid, (perLesson.get(lid) || 0) + 1);
    const m = perCourseUser.get(cid) || new Map();
    m.set(uid, (m.get(uid) || 0) + 1);
    perCourseUser.set(cid, m);
  }
  const pMap = new Map(products.map((p) => [String(p._id), p]));
  const rows = courses.map((c) => {
    const ls = lessons.filter((l) => String(l.categoryId) === String(c._id));
    const users = perCourseUser.get(String(c._id)) || new Map();
    const total = [...users.values()].reduce((a, b) => a + b, 0);
    const finished = ls.length ? [...users.values()].filter((n) => n >= ls.length).length : 0;
    const p = pMap.get(String(c.productId));
    return {
      courseId: String(c._id), title: c.title, courseNumber: c.courseNumber, archived: c.status === CS.ARCHIVED,
      container: p ? { id: String(p._id), title: p.title } : null,
      lessonCount: ls.length, startedClients: users.size, completedClients: finished,
      startedRate: pct(users.size, eligible), completionRate: pct(finished, eligible), averageProgressPct: pct(total, eligible * ls.length),
      ...(withLessons ? { lessons: ls.map((l) => ({ lessonId: String(l._id), number: l.number, title: l.title, completions: perLesson.get(String(l._id)) || 0, completionPct: pct(perLesson.get(String(l._id)) || 0, eligible) })) } : {}),
    };
  });
  const withContent = rows.filter((r) => r.lessonCount);
  return { eligibleClients: eligible, summary: { courses: rows.length, averageProgressPct: withContent.length ? Math.round((10 * withContent.reduce((a, r) => a + r.averageProgressPct, 0)) / withContent.length) / 10 : 0 }, courses: rows };
}
