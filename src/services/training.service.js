// Admin: containers (products), courses (categories), moving a course, course lifecycle.
import { Product, Category, Lesson, Resource, Offer } from '../db/models/index.js';
import { PRESENTATION as P, CONTENT_STATUS as CS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/slug.js';
import { pageParams } from '../utils/pagination.js';
import { buildCourseTitle, parseCourseTitle, assertNoDates, terminologyWarnings } from '../utils/naming.js';
import * as lessonSvc from './lesson.service.js';
import * as entitlement from './entitlement.service.js';
import * as audit from './audit.service.js';

const sid = (x) => String(x._id ?? x);

export async function listContainers() {
  const products = await Product.find({ presentation: P.COURSE_LIBRARY }).sort({ order: 1 }).lean();
  const cats = await Category.find({ productId: { $in: products.map(sid) }, kind: 'course', status: { $ne: CS.REMOVED } }).sort({ courseNumber: 1 }).lean();
  const lc = new Map((await Lesson.aggregate([{ $match: { categoryId: { $in: cats.map((c) => c._id) }, status: { $ne: CS.REMOVED } } }, { $group: { _id: '$categoryId', n: { $sum: 1 } } }])).map((r) => [String(r._id), r.n]));
  return products.map((p) => ({ ...p, id: sid(p), courses: cats.filter((c) => String(c.productId) === sid(p)).map((c) => ({ ...c, id: sid(c), lessonCount: lc.get(sid(c)) || 0 })) }));
}

export async function createCourse({ productId, courseNumber, name, description }, actor) {
  const product = await Product.findById(productId).lean();
  if (!product || product.presentation !== P.COURSE_LIBRARY) throw ApiError.badRequest('productId must be a training container');
  const title = buildCourseTitle(courseNumber, name);
  assertNoDates(title);
  const prods = await Product.find({ presentation: P.COURSE_LIBRARY }).select('_id').lean();
  if (await Category.exists({ productId: { $in: prods.map((p) => p._id) }, kind: 'course', courseNumber, status: { $ne: CS.REMOVED } })) throw ApiError.conflict(`Course ${courseNumber} already exists`);
  const cat = await Category.create({ productId, kind: 'course', title, slug: slugify(title), description, courseNumber, order: courseNumber, status: CS.DRAFT });
  await audit.log({ actor, action: 'course.create', entity: 'category', entityId: cat._id, after: { title, productId } });
  return cat;
}
export async function updateCourse(id, { name, courseNumber, description }, actor) {
  const cat = await Category.findById(id);
  if (!cat || cat.kind !== 'course') throw ApiError.notFound('Course not found');
  const before = { title: cat.title, description: cat.description };
  if (name !== undefined || courseNumber !== undefined) {
    const cur = parseCourseTitle(cat.title);
    const title = buildCourseTitle(courseNumber ?? cur.courseNumber, name ?? cur.name);
    assertNoDates(title);
    cat.title = title; cat.slug = slugify(title); cat.courseNumber = courseNumber ?? cur.courseNumber; cat.order = cat.courseNumber;
  }
  if (description !== undefined) cat.description = description;
  await cat.save();
  await audit.log({ actor, action: 'course.update', entity: 'category', entityId: id, before, after: { title: cat.title, description: cat.description } });
  return cat;
}
export async function getCourse(id) {
  const cat = await Category.findById(id).lean();
  if (!cat) throw ApiError.notFound('Course not found');
  const lessons = await Lesson.find({ categoryId: id, status: { $ne: CS.REMOVED } }).sort({ number: 1, order: 1 }).lean();
  const product = await Product.findById(cat.productId).lean();
  return { ...cat, id: sid(cat), container: { id: sid(product), key: product.key, title: product.title }, lessons };
}

/** publish | unpublish | archive | restore | remove for a whole course. publish + includeLessons also publishes passing draft lessons. */
export async function courseTransition(id, action, { includeLessons = false, allowMissingCaptions = false } = {}, actor) {
  const cat = await Category.findById(id);
  if (!cat) throw ApiError.notFound('Course not found');
  const from = cat.status;
  await Category.updateOne({ _id: id }, lessonSvc.statusPatch(action, from));
  const report = { published: [], blocked: [] };
  if (action === 'publish' && includeLessons) {
    const drafts = await Lesson.find({ categoryId: id, status: CS.DRAFT }).sort({ number: 1 });
    for (const l of drafts) {
      try { await lessonSvc.transition(l._id, 'publish', { allowMissingCaptions }, actor); report.published.push(l.title); } catch (e) { report.blocked.push({ lesson: l.title, errors: e.details?.errors || [e.message] }); }
    }
  }
  const warnings = terminologyWarnings(`${cat.title}\n${cat.description || ''}`);
  await audit.log({ actor, action: `course.${action}`, entity: 'category', entityId: id, before: { status: from }, after: { status: (await Category.findById(id).lean()).status, ...report } });
  return { course: await Category.findById(id).lean(), ...report, warnings };
}

/**
 * Move a course to another container. Changing who sees it is just "which container is it in".
 * Lessons and resources carry a denormalised productId, so they are updated with it. Progress is keyed by lessonId: untouched.
 */
export async function moveCourse(id, targetProductId, actor) {
  const cat = await Category.findById(id);
  const target = await Product.findById(targetProductId).lean();
  if (!cat || cat.kind !== 'course') throw ApiError.notFound('Course not found');
  if (!target || target.presentation !== P.COURSE_LIBRARY) throw ApiError.badRequest('Target must be a training container');
  if (sid(cat.productId) === sid(target)) return cat;
  if (await Category.exists({ productId: target._id, slug: cat.slug, _id: { $ne: cat._id } })) throw ApiError.conflict('A course with that slug already exists in the target container');
  const from = sid(cat.productId);
  await Category.updateOne({ _id: id }, { $set: { productId: target._id } });
  const lessonIds = (await Lesson.find({ categoryId: id }).select('_id').lean()).map((l) => l._id);
  await Lesson.updateMany({ categoryId: id }, { $set: { productId: target._id } });
  await Resource.updateMany({ lessonId: { $in: lessonIds } }, { $set: { productId: target._id } });
  entitlement.invalidateAll();
  await audit.log({ actor, action: 'course.move', entity: 'category', entityId: id, before: { productId: from }, after: { productId: sid(target) } });
  return Category.findById(id).lean();
}
export const reorderLessons = (categoryId, lessonIds, actor) => lessonSvc.reorderTraining(categoryId, lessonIds, actor);

/** Owner: add a container. It is added to the all-access and staff offers so nobody loses content when it is created. */
export async function createContainer({ title, navGroup, order }, actor) {
  const key = slugify(title);
  if (/\b(tier|premium|basic|executive|advisory only)\b/i.test(title)) throw ApiError.validation('Name containers by topic or audience, never by tier or price', { title: ['Contains a tier word'] });
  if (await Product.exists({ key })) throw ApiError.conflict('A container with that name already exists');
  const p = await Product.create({ key, title, presentation: P.COURSE_LIBRARY, navGroup: navGroup || 'b3 Growth System™ Training', order: order ?? 10, status: CS.LIVE });
  await Offer.updateMany({ key: { $in: ['portal-all-access', 'portal-staff'] } }, { $addToSet: { productIds: p._id } });
  entitlement.invalidateAll();
  await audit.log({ actor, action: 'container.create', entity: 'product', entityId: p._id, after: { key, title } });
  return p;
}

// ---------------- DELETE /v1/admin/training/containers/:id ----------------
/**
 * mode 'archive' (default) -> status archived. mode 'delete' -> removed from the database and from every offer.
 * Both are refused unless the container is EMPTY (no courses), and the last training container can never be removed.
 */
export async function removeContainer(id, mode = 'archive', actor) {
  const p = await Product.findById(id);
  if (!p || p.presentation !== P.COURSE_LIBRARY) throw ApiError.notFound('Container not found');
  const others = await Product.countDocuments({ presentation: P.COURSE_LIBRARY, _id: { $ne: p._id }, status: { $ne: CS.ARCHIVED } });
  if (!others) throw ApiError.conflict('You cannot remove the last training container');
  const courses = await Category.countDocuments({ productId: p._id, status: { $ne: CS.REMOVED } });
  if (courses) throw ApiError.conflict(`This container still has ${courses} course${courses === 1 ? '' : 's'}. Move or remove them first.`, { courses });
  const before = { key: p.key, title: p.title, status: p.status };
  if (mode === 'delete') {
    if (await Category.exists({ productId: p._id })) throw ApiError.conflict('Removed courses still point at this container, so it can only be archived');
    await Product.deleteOne({ _id: p._id });
    await Offer.updateMany({}, { $pull: { productIds: p._id } }); // nobody's access list keeps a dangling id
  } else if (p.status !== CS.ARCHIVED) {
    p.status = CS.ARCHIVED;
    await p.save();
  }
  entitlement.invalidateAll();
  await audit.log({ actor, action: 'container.remove', entity: 'product', entityId: id, before, after: { mode, title: before.title } });
  return { id: String(id), mode, status: mode === 'delete' ? 'deleted' : CS.ARCHIVED };
}

// ---------------- GET /v1/admin/training/courses ----------------
/** Flat list of every course with its parent container and lesson counts. Filters: productId, status, q. */
export async function listCourses(q = {}) {
  const { page, limit, skip } = pageParams(q);
  const f = { kind: 'course', status: q.status || { $ne: CS.REMOVED } };
  if (q.productId) f.productId = q.productId;
  if (q.q) f.title = new RegExp(String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [cats, total] = await Promise.all([Category.find(f).sort({ courseNumber: 1 }).skip(skip).limit(limit).lean(), Category.countDocuments(f)]);
  const [products, counts] = await Promise.all([
    Product.find({ _id: { $in: cats.map((c) => c.productId) } }).select('key title status').lean(),
    Lesson.aggregate([{ $match: { categoryId: { $in: cats.map((c) => c._id) }, status: { $ne: CS.REMOVED } } }, { $group: { _id: { c: '$categoryId', s: '$status' }, n: { $sum: 1 } } }]),
  ]);
  const pMap = new Map(products.map((p) => [sid(p), p]));
  const byCat = new Map();
  for (const r of counts) { const k = String(r._id.c); byCat.set(k, { ...(byCat.get(k) || {}), [r._id.s]: r.n }); }
  const items = cats.map((c) => {
    const n = byCat.get(sid(c)) || {};
    const p = pMap.get(String(c.productId));
    return {
      id: sid(c), slug: c.slug, title: c.title, courseNumber: c.courseNumber, description: c.description || '', status: c.status,
      container: p ? { id: sid(p), key: p.key, title: p.title } : null,
      lessons: { total: (n.live || 0) + (n.draft || 0) + (n.archived || 0), live: n.live || 0, draft: n.draft || 0, archived: n.archived || 0 }, // totals include the 00 welcome lesson
      updatedAt: c.updatedAt,
    };
  });
  return { items, total, page, limit };
}
