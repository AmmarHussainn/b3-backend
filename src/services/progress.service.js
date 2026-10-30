import { Progress, Lesson } from '../db/models/index.js';
import { PRESENTATION as P, CONTENT_STATUS as CS } from '../config/constants.js';
import * as content from './content.service.js';

const sid = (x) => String(x._id ?? x);

export async function setPosition(userId, lessonId, positionSeconds, ent) {
  const { lesson } = await content.getAccessibleLesson(lessonId, ent);
  const pos = Math.max(0, Math.floor(positionSeconds));
  const p = await Progress.findOneAndUpdate({ userId, lessonId: lesson._id }, { $set: { positionSeconds: pos } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return { lessonId: sid(lesson), positionSeconds: p.positionSeconds, completed: p.completed };
}

/** Mark complete / incomplete. History is keyed by lessonId, so archiving or moving content never loses it. */
export async function setCompleted(userId, lessonId, completed, ent) {
  const { lesson, product, category } = await content.getAccessibleLesson(lessonId, ent);
  await Progress.findOneAndUpdate({ userId, lessonId: lesson._id }, { $set: { completed, completedAt: completed ? new Date() : null } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const out = { lessonId: sid(lesson), completed };
  if (product.presentation === P.COURSE_LIBRARY) {
    const s = await content.courseSummary(category._id, userId, ent);
    out.course = { id: sid(category), slug: category.slug, progress: s.progress, nextLesson: s.nextLesson };
  }
  return out;
}

/** Continue where you left off: the latest unfinished lesson, or the next lesson after a finished one. */
export async function getContinue(userId, ent) {
  const rows = await Progress.find({ userId }).sort({ updatedAt: -1 }).limit(25).lean();
  if (!rows.length) return null;
  const { lessons, pMap, cMap } = await content.scope(ent);
  const byId = new Map(lessons.map((l) => [sid(l), l]));
  for (const r of rows) {
    const l = byId.get(String(r.lessonId));
    const p = l && pMap.get(String(l.productId));
    const c = l && cMap.get(String(l.categoryId));
    if (!l || p?.presentation !== P.COURSE_LIBRARY || c?.status === CS.ARCHIVED) continue;
    let target = null; let reason = 'resume';
    if (!r.completed) target = l;
    else {
      const mates = lessons.filter((x) => String(x.categoryId) === sid(c) && x.status !== CS.ARCHIVED).sort((a, b) => a.number - b.number);
      const pm = await content.progressMap(userId, mates.map((m) => m._id));
      target = mates.find((m) => !pm.get(sid(m))?.completed) || null; reason = 'next';
    }
    if (!target) continue; // that course is finished: look further back
    const s = await content.courseSummary(c._id, userId, ent);
    const tp = (await content.progressMap(userId, [target._id])).get(sid(target));
    return { reason, course: { id: sid(c), slug: c.slug, title: c.title, courseNumber: c.courseNumber, percent: s.progress.percent }, lesson: { id: sid(target), slug: target.slug, title: target.title, number: target.number, positionSeconds: tp?.positionSeconds || 0 } };
  }
  return null;
}

export async function getOverall(userId, ent) {
  const { lessons, pMap } = await content.scope(ent);
  const train = lessons.filter((l) => pMap.get(String(l.productId))?.presentation === P.COURSE_LIBRARY && l.number >= 1 && l.status === CS.LIVE);
  const completed = train.length ? await Progress.countDocuments({ userId, completed: true, lessonId: { $in: train.map((l) => l._id) } }) : 0;
  return { completed, total: train.length, percent: train.length ? Math.round((100 * completed) / train.length) : 0 };
}

export async function getDashboard(user, ent) {
  const [cont, latestReplay, overall, started] = await Promise.all([getContinue(user.id, ent), content.getLatestReplay(ent), getOverall(user.id, ent), Progress.exists({ userId: user.id })]);
  return { firstName: user.firstName || null, continue: cont, latestReplay, overall, showNewHere: !started };
}
