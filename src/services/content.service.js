// Member-facing reads. EVERY query is scoped by req.entitlements (user tags -> offers -> products).
// Nothing here checks a tier name. Training output never contains dates or reverse-chronological ordering.
import { Product, Category, Lesson, Resource, Progress } from '../db/models/index.js';
import { PRESENTATION as P, PRODUCT_KEYS, CONTENT_STATUS as CS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { pageParams } from '../utils/pagination.js';
import { visibleStatuses, hasProduct } from './entitlement.service.js';
import * as settings from './settings.service.js';
import * as stream from '../integrations/bunny/stream.client.js';

const sid = (x) => String(x._id ?? x);
const archivedLast = (a, b) => (a.status === CS.ARCHIVED) - (b.status === CS.ARCHIVED);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const currentVersion = (r) => r.versions?.find((v) => v.n === r.currentVersion) || r.versions?.[r.versions.length - 1];
const resourceDto = (r) => ({ id: sid(r), title: r.title, assetType: r.assetType, topic: r.topic || null, fileName: currentVersion(r)?.fileName, version: r.currentVersion, sizeBytes: currentVersion(r)?.sizeBytes || null });

export async function progressMap(userId, lessonIds) {
  if (!lessonIds.length) return new Map();
  const rows = await Progress.find({ userId, lessonId: { $in: lessonIds } }).lean();
  return new Map(rows.map((r) => [String(r.lessonId), r]));
}
const base = (l, pm) => {
  const p = pm.get(sid(l));
  return {
    id: sid(l), slug: l.slug, title: l.title, description: l.description || '', durationSeconds: l.durationSeconds || null, thumbnailUrl: l.thumbnailUrl || null,
    hasVideo: l.videoStatus === 'ready', archived: l.status === CS.ARCHIVED, draft: l.status === CS.DRAFT, completed: Boolean(p?.completed), positionSeconds: p?.positionSeconds || 0,
  };
};
const trainingLesson = (l, pm) => ({ ...base(l, pm), number: l.number }); // no dates, ever
const counted = (lessons) => lessons.filter((l) => l.number >= 1 && l.status !== CS.ARCHIVED);
export function courseProgress(lessons, pm) {
  const c = counted(lessons);
  const completed = c.filter((l) => pm.get(sid(l))?.completed).length;
  return { completed, total: c.length, percent: c.length ? Math.round((100 * completed) / c.length) : 0 };
}

async function visibleProducts(ent, extra = {}) {
  if (!ent.productIds.length) return [];
  return Product.find({ _id: { $in: ent.productIds }, status: { $in: visibleStatuses(ent) }, ...extra }).sort({ order: 1 }).lean();
}
/** Products + categories + lessons this member may see. Used by library, search, dashboard. */
export async function scope(ent, { select = 'title slug description categoryId productId number sessionDate status order videoStatus durationSeconds thumbnailUrl' } = {}) {
  const statuses = visibleStatuses(ent);
  const products = await visibleProducts(ent);
  const cats = products.length ? await Category.find({ productId: { $in: products.map(sid) }, status: { $in: statuses } }).lean() : [];
  const lessons = cats.length ? await Lesson.find({ categoryId: { $in: cats.map(sid) }, status: { $in: statuses } }).select(select).lean() : [];
  return { statuses, products, cats, lessons, pMap: new Map(products.map((p) => [sid(p), p])), cMap: new Map(cats.map((c) => [sid(c), c])) };
}

/** 404 (not 403) for anything outside the member's offers: no leaking that content exists. */
export async function getAccessibleLesson(lessonId, ent) {
  const lesson = await Lesson.findById(lessonId).lean();
  const statuses = visibleStatuses(ent);
  if (!lesson || !hasProduct(ent, lesson.productId) || !statuses.includes(lesson.status)) throw ApiError.notFound('Lesson not found');
  const [product, category] = await Promise.all([Product.findById(lesson.productId).lean(), Category.findById(lesson.categoryId).lean()]);
  if (!product || !category || !statuses.includes(product.status) || !statuses.includes(category.status)) throw ApiError.notFound('Lesson not found');
  return { lesson, product, category };
}
export async function resolveLessonBySlugs(categorySlug, lessonSlug, ent) {
  const { cats } = await scope(ent, { select: '_id' });
  const catIds = cats.filter((c) => c.slug === categorySlug).map(sid);
  const l = catIds.length ? await Lesson.findOne({ categoryId: { $in: catIds }, slug: lessonSlug }).select('_id').lean() : null;
  if (!l) throw ApiError.notFound('Lesson not found');
  return getAccessibleLesson(l._id, ent);
}

export async function lessonDetail({ lesson, product, category }, userId, ent) {
  const statuses = visibleStatuses(ent);
  const [pm, resources] = await Promise.all([
    progressMap(userId, [lesson._id]),
    Resource.find({ lessonId: lesson._id, status: { $in: statuses } }).sort({ createdAt: 1 }).lean(),
  ]);
  const out = { ...base(lesson, pm), kind: product.presentation, category: { id: sid(category), title: category.title, slug: category.slug, kind: category.kind }, captions: lesson.captions || [], resources: resources.map(resourceDto) };
  if (product.presentation === P.ARCHIVE) out.sessionDate = lesson.sessionDate; // dates belong to replays only
  if (product.presentation === P.COURSE_LIBRARY) {
    out.number = lesson.number;
    const sib = (await Lesson.find({ categoryId: lesson.categoryId, status: { $in: statuses } }).select('title slug number status order').lean()).sort((a, b) => archivedLast(a, b) || a.number - b.number);
    const i = sib.findIndex((s) => sid(s) === sid(lesson));
    const nav = (s) => (s ? { id: sid(s), slug: s.slug, title: s.title, number: s.number } : null);
    out.prev = nav(sib[i - 1]);
    out.next = nav(sib[i + 1]);
  }
  return out;
}

/** Signed, expiring player URL. Only reachable through an entitled lesson. */
export function playback({ lesson }) {
  if (!lesson.bunnyVideoId || lesson.videoStatus !== 'ready') throw ApiError.conflict('This video is not ready yet');
  const { url, expiresAt } = stream.signedEmbedUrl(lesson.bunnyVideoId);
  return { embedUrl: url, expiresAt, durationSeconds: lesson.durationSeconds || null, captions: lesson.captions || [] };
}

// ---------------- Start Here ----------------
export async function getStartHere(ent) {
  const [product] = await visibleProducts(ent, { key: PRODUCT_KEYS.START_HERE });
  if (!product) return { title: 'Start Here', lessons: [], links: await settings.getMemberLinks() };
  const lessons = await Lesson.find({ productId: product._id, status: { $in: visibleStatuses(ent) } }).sort({ order: 1, createdAt: 1 }).lean();
  return { title: product.title, lessons: lessons.map((l) => ({ id: sid(l), slug: l.slug, title: l.title, description: l.description || '', hasVideo: l.videoStatus === 'ready', durationSeconds: l.durationSeconds || null, draft: l.status === CS.DRAFT })), links: await settings.getMemberLinks() };
}

// ---------------- Growth Lab replays: by year, newest first, WITH dates ----------------
export async function getReplays(ent, userId) {
  const [product] = await visibleProducts(ent, { key: PRODUCT_KEYS.GROWTH_LAB_REPLAYS });
  if (!product) return { years: [] };
  const statuses = visibleStatuses(ent);
  const cats = await Category.find({ productId: product._id, kind: 'year', status: { $in: statuses } }).lean();
  const lessons = await Lesson.find({ productId: product._id, categoryId: { $in: cats.map(sid) }, status: { $in: statuses } }).lean();
  const [pm, resources] = await Promise.all([progressMap(userId, lessons.map((l) => l._id)), Resource.find({ lessonId: { $in: lessons.map((l) => l._id) }, status: { $in: statuses } }).lean()]);
  const resBy = new Map();
  resources.forEach((r) => resBy.set(String(r.lessonId), [...(resBy.get(String(r.lessonId)) || []), { id: sid(r), title: r.title, assetType: r.assetType }]));
  const years = cats.sort((a, b) => b.year - a.year).map((c) => ({
    id: sid(c), year: c.year, title: c.title,
    replays: lessons.filter((l) => String(l.categoryId) === sid(c))
      .sort((a, b) => archivedLast(a, b) || new Date(b.sessionDate) - new Date(a.sessionDate))
      .map((l) => ({ ...base(l, pm), sessionDate: l.sessionDate, watched: Boolean(pm.get(sid(l))?.completed), attachments: resBy.get(sid(l)) || [] })),
  }));
  return { years };
}
export async function getLatestReplay(ent) {
  const [product] = await visibleProducts(ent, { key: PRODUCT_KEYS.GROWTH_LAB_REPLAYS });
  if (!product) return null;
  const l = await Lesson.findOne({ productId: product._id, status: CS.LIVE }).sort({ sessionDate: -1 }).lean();
  if (!l) return null;
  return { id: sid(l), slug: l.slug, title: l.title, description: l.description || '', sessionDate: l.sessionDate, durationSeconds: l.durationSeconds || null, thumbnailUrl: l.thumbnailUrl || null };
}

// ---------------- Training: course library, course page ----------------
export async function getTrainingLibrary(ent, userId) {
  const products = await visibleProducts(ent, { presentation: P.COURSE_LIBRARY });
  const heading = products[0]?.navGroup || 'b3 Growth System™ Training';
  if (!products.length) return { heading, courses: [] };
  const statuses = visibleStatuses(ent);
  const cats = await Category.find({ productId: { $in: products.map(sid) }, kind: 'course', status: { $in: statuses } }).lean();
  const lessons = await Lesson.find({ categoryId: { $in: cats.map(sid) }, status: { $in: statuses } }).select('categoryId number status').lean();
  const pm = await progressMap(userId, lessons.map((l) => l._id));
  const courses = cats.sort((a, b) => archivedLast(a, b) || a.courseNumber - b.courseNumber).map((c) => {
    const ls = lessons.filter((l) => String(l.categoryId) === sid(c));
    const progress = courseProgress(ls, pm);
    return { id: sid(c), slug: c.slug, title: c.title, description: c.description || '', courseNumber: c.courseNumber, archived: c.status === CS.ARCHIVED, draft: c.status === CS.DRAFT, lessonCount: progress.total, progress };
  });
  return { heading, courses };
}

export async function courseSummary(categoryId, userId, ent) {
  const lessons = await Lesson.find({ categoryId, status: { $in: visibleStatuses(ent) } }).lean();
  lessons.sort((a, b) => archivedLast(a, b) || a.number - b.number);
  const pm = await progressMap(userId, lessons.map((l) => l._id));
  const candidates = lessons.filter((l) => l.status !== CS.ARCHIVED);
  const next = candidates.find((l) => !pm.get(sid(l))?.completed);
  return { lessons, pm, progress: courseProgress(lessons, pm), nextLesson: next ? trainingLesson(next, pm) : null };
}
export async function getCourse(slug, ent, userId) {
  const products = await visibleProducts(ent, { presentation: P.COURSE_LIBRARY });
  const cat = products.length ? await Category.findOne({ productId: { $in: products.map(sid) }, kind: 'course', slug, status: { $in: visibleStatuses(ent) } }).lean() : null;
  if (!cat) throw ApiError.notFound('Course not found');
  const { lessons, pm, progress, nextLesson } = await courseSummary(cat._id, userId, ent);
  const welcome = lessons.find((l) => l.number === 0);
  return {
    course: { id: sid(cat), slug: cat.slug, title: cat.title, description: cat.description || '', courseNumber: cat.courseNumber, archived: cat.status === CS.ARCHIVED },
    welcome: welcome ? trainingLesson(welcome, pm) : null,
    lessons: lessons.filter((l) => l.number >= 1).map((l) => trainingLesson(l, pm)), // numbered, in order
    progress, nextLesson,
  };
}

// ---------------- Resource Library ----------------
export async function getResourceLibrary(ent, q = {}) {
  const { products, cats, lessons, pMap, cMap, statuses } = await scope(ent);
  let scoped = lessons;
  if (q.productKey) { const pid = products.find((p) => p.key === q.productKey); scoped = pid ? lessons.filter((l) => String(l.productId) === sid(pid)) : []; }
  const lessonMap = new Map(scoped.map((l) => [sid(l), l]));
  const allIds = lessons.map((l) => l._id);
  const filter = { lessonId: { $in: scoped.map((l) => l._id) }, status: { $in: statuses } };
  if (q.type) filter.assetType = q.type;
  if (q.topic) filter.topic = new RegExp(`^${esc(q.topic)}$`, 'i');
  if (q.q) filter.$or = [{ title: new RegExp(esc(q.q), 'i') }, { topic: new RegExp(esc(q.q), 'i') }];
  const { page, limit, skip } = pageParams(q);
  const [rows, total, types, topics] = await Promise.all([
    Resource.find(filter).sort({ title: 1 }).skip(skip).limit(limit).lean(),
    Resource.countDocuments(filter),
    Resource.distinct('assetType', { lessonId: { $in: allIds }, status: { $in: statuses } }),
    Resource.distinct('topic', { lessonId: { $in: allIds }, status: { $in: statuses }, topic: { $ne: null } }),
  ]);
  const items = rows.map((r) => {
    const l = lessonMap.get(String(r.lessonId));
    const c = cMap.get(String(l?.categoryId));
    const p = pMap.get(String(l?.productId));
    const v = currentVersion(r);
    return { ...resourceDto(r), updatedAt: v?.uploadedAt, lesson: l && { id: sid(l), title: l.title, slug: l.slug, number: p?.presentation === P.COURSE_LIBRARY ? l.number : undefined, categorySlug: c?.slug, categoryTitle: c?.title, product: p?.key, kind: p?.presentation } };
  });
  return { items, total, page, limit, extra: { facets: { types: types.sort(), topics: topics.sort() } } };
}
/** Member download access: the resource's lesson must be entitled and visible. */
export async function getAccessibleResource(id, ent) {
  const r = await Resource.findById(id);
  if (!r || !visibleStatuses(ent).includes(r.status)) throw ApiError.notFound('File not found');
  await getAccessibleLesson(r.lessonId, ent);
  return r;
}

// ---------------- Search (lesson titles + descriptions) ----------------
export async function search(q, ent, limit = 20) {
  const term = String(q || '').trim().slice(0, 100);
  if (term.length < 2) return { query: term, results: [] };
  const { cats, pMap, cMap, statuses } = await scope(ent, { select: '_id' });
  if (!cats.length) return { query: term, results: [] };
  const catIds = cats.map(sid);
  const sel = 'title slug description categoryId productId number sessionDate status';
  let hits = await Lesson.find({ $text: { $search: term }, categoryId: { $in: catIds }, status: { $in: statuses } }, { score: { $meta: 'textScore' } }).select(sel).sort({ score: { $meta: 'textScore' } }).limit(limit).lean();
  if (hits.length < 5) { // partial words ("cash fl") are not matched by the text index: fall back to a substring match
    const rx = new RegExp(esc(term), 'i');
    const more = await Lesson.find({ $or: [{ title: rx }, { description: rx }], categoryId: { $in: catIds }, status: { $in: statuses }, _id: { $nin: hits.map((h) => h._id) } }).select(sel).limit(limit - hits.length).lean();
    hits = [...hits, ...more];
  }
  const results = hits.map((l) => {
    const p = pMap.get(String(l.productId)); const c = cMap.get(String(l.categoryId));
    return { id: sid(l), title: l.title, snippet: (l.description || '').slice(0, 160), slug: l.slug, kind: p?.presentation, categorySlug: c?.slug, categoryTitle: c?.title, archived: l.status === CS.ARCHIVED, ...(p?.presentation === P.ARCHIVE ? { sessionDate: l.sessionDate } : {}), ...(p?.presentation === P.COURSE_LIBRARY ? { number: l.number } : {}) };
  });
  return { query: term, results };
}
