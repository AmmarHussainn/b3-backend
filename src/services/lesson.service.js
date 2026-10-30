// Admin: lessons for training + Start Here, and the shared lifecycle (draft / live / archived / removed).
import { Lesson, Category, Product, Resource, Progress } from '../db/models/index.js';
import { CONTENT_STATUS as CS, PRESENTATION as P, VIDEO_STATUS as V } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/slug.js';
import { pageParams } from '../utils/pagination.js';
import { WELCOME_TITLE, parseLessonTitle, assertNoDates, buildLessonTitle, terminologyWarnings } from '../utils/naming.js';
import * as stream from '../integrations/bunny/stream.client.js';
import * as audit from './audit.service.js';

const sid = (x) => String(x._id ?? x);

/** status machine shared by lessons, replays and courses */
const MACHINE = {
  publish: { from: [CS.DRAFT], to: CS.LIVE },
  unpublish: { from: [CS.LIVE], to: CS.DRAFT },
  archive: { from: [CS.LIVE, CS.DRAFT], to: CS.ARCHIVED },
  restore: { from: [CS.ARCHIVED, CS.REMOVED], to: null }, // archived -> live, removed -> draft
  remove: { from: [CS.DRAFT, CS.LIVE, CS.ARCHIVED], to: CS.REMOVED },
};
export function nextStatus(action, current) {
  const m = MACHINE[action];
  if (!m) throw ApiError.badRequest(`Unknown action "${action}"`);
  if (!m.from.includes(current)) throw ApiError.conflict(`Cannot ${action} content that is ${current}`);
  if (action === 'restore') return current === CS.ARCHIVED ? CS.LIVE : CS.DRAFT;
  return m.to;
}
export const statusPatch = (action, current) => {
  const status = nextStatus(action, current);
  const set = { status };
  const unset = {};
  if (status === CS.LIVE) { unset.archivedAt = 1; }
  if (status === CS.ARCHIVED) set.archivedAt = new Date();
  if (action === 'publish') set.publishedAt = new Date();
  return { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) };
};

async function ctx(id) {
  const lesson = await Lesson.findById(id);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  const [category, product] = await Promise.all([Category.findById(lesson.categoryId).lean(), Product.findById(lesson.productId).lean()]);
  return { lesson, category, product };
}

/** Everything that must be true before a lesson goes live. */
export function publishChecks(lesson, product, { allowMissingCaptions = false } = {}) {
  const errors = []; const warnings = [];
  if (!lesson.description?.trim()) errors.push('Add a two to four sentence description.');
  const needsVideo = product.presentation !== P.FLAT;
  if (needsVideo && !lesson.bunnyVideoId) errors.push('Upload a video.');
  if (lesson.bunnyVideoId && lesson.videoStatus !== V.READY) errors.push(`The video is not ready yet (${lesson.videoStatus}).`);
  if (lesson.bunnyVideoId && !(lesson.captions || []).length) {
    if (product.presentation === P.COURSE_LIBRARY && !allowMissingCaptions) errors.push('Captions or a transcript are required on training lessons.');
    else warnings.push('No captions uploaded (strongly preferred).');
  }
  warnings.push(...terminologyWarnings(`${lesson.title}\n${lesson.description || ''}`));
  return { errors, warnings };
}

export async function get(id) {
  const { lesson, category, product } = await ctx(id);
  const resources = await Resource.find({ lessonId: lesson._id, status: { $ne: CS.REMOVED } }).lean();
  const checks = publishChecks(lesson, product);
  return { ...lesson.toObject(), category, product: { id: sid(product), key: product.key, title: product.title, presentation: product.presentation }, resources, publishChecks: checks };
}
export async function list(q = {}) {
  const { page, limit, skip } = pageParams(q);
  const f = { status: q.status ? q.status : { $ne: CS.REMOVED } };
  if (q.categoryId) f.categoryId = q.categoryId;
  if (q.productId) f.productId = q.productId;
  if (q.q) f.title = new RegExp(String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([Lesson.find(f).sort({ categoryId: 1, number: 1, order: 1 }).skip(skip).limit(limit).lean(), Lesson.countDocuments(f)]);
  return { items, total, page, limit };
}

function resolveTitle(product, title) {
  if (product.presentation === P.COURSE_LIBRARY) {
    const { number } = parseLessonTitle(title);
    assertNoDates(title);
    return { number };
  }
  return { number: undefined };
}

export async function create({ categoryId, productKey, title, description }, actor) {
  if (!categoryId && productKey) { // Start Here is flat: its lessons live in one hidden holding category
    const p = await Product.findOne({ key: productKey }).lean();
    const holder = p && (await Category.findOne({ productId: p._id, slug: 'general' }).lean());
    if (!holder) throw ApiError.conflict('Run the seed first: Start Here does not exist');
    categoryId = holder._id;
  }
  const category = await Category.findById(categoryId).lean();
  if (!category) throw ApiError.notFound('Category not found');
  const product = await Product.findById(category.productId).lean();
  if (product.presentation === P.ARCHIVE) throw ApiError.badRequest('Create Growth Lab replays with POST /v1/admin/replays');
  if (product.presentation === P.INDEX) throw ApiError.badRequest('The Resource Library is an index: upload files against a lesson instead');
  const { number } = resolveTitle(product, title);
  const last = await Lesson.findOne({ categoryId }).sort({ order: -1 }).select('order').lean();
  const lesson = await Lesson.create({ productId: product._id, categoryId, title, slug: slugify(title), number, description, order: (last?.order ?? -1) + 1, status: CS.DRAFT });
  await audit.log({ actor, action: 'lesson.create', entity: 'lesson', entityId: lesson._id, after: { title, categoryId } });
  return lesson;
}

export async function update(id, patch, actor) {
  const { lesson, product } = await ctx(id);
  const before = { title: lesson.title, description: lesson.description };
  if (patch.title !== undefined && patch.title !== lesson.title) {
    const { number } = resolveTitle(product, patch.title);
    lesson.title = patch.title; lesson.slug = slugify(patch.title);
    if (number !== undefined) lesson.number = number;
  }
  if (patch.description !== undefined) lesson.description = patch.description;
  await lesson.save();
  await audit.log({ actor, action: 'lesson.update', entity: 'lesson', entityId: lesson._id, before, after: { title: lesson.title, description: lesson.description } });
  return lesson;
}

/** publish | unpublish | archive | restore | remove. Never touches progress or files. */
export async function transition(id, action, { allowMissingCaptions = false } = {}, actor) {
  const { lesson, product } = await ctx(id);
  let warnings = [];
  if (action === 'publish') {
    const c = publishChecks(lesson, product, { allowMissingCaptions });
    if (c.errors.length) throw ApiError.conflict('This lesson cannot be published yet', { errors: c.errors, warnings: c.warnings });
    warnings = c.warnings;
  }
  const from = lesson.status;
  await Lesson.updateOne({ _id: lesson._id }, statusPatch(action, from));
  const after = await Lesson.findById(id).lean();
  await audit.log({ actor, action: `lesson.${action}`, entity: 'lesson', entityId: id, before: { status: from }, after: { status: after.status } });
  return { lesson: after, warnings };
}

/**
 * Training drag-and-drop: lessonIds = the numbered lessons in the new order. Numbers (and the "Nn - " title prefix) are rewritten.
 * Welcome (00) never moves. Progress is keyed by lesson id so completion history is untouched.
 */
export async function reorderTraining(categoryId, lessonIds, actor) {
  const lessons = await Lesson.find({ categoryId, status: { $ne: CS.REMOVED }, number: { $gte: 1 } });
  const have = new Set(lessons.map(sid));
  if (lessonIds.length !== have.size || !lessonIds.every((x) => have.has(String(x)))) throw ApiError.badRequest('lessonIds must list every numbered lesson in the course exactly once');
  const byId = new Map(lessons.map((l) => [sid(l), l]));
  await Lesson.bulkWrite(lessons.map((l) => ({ updateOne: { filter: { _id: l._id }, update: { $set: { slug: `tmp-${sid(l)}` } } } }))); // avoid unique-slug collisions mid-renumber
  await Lesson.bulkWrite(lessonIds.map((lid, i) => {
    const l = byId.get(String(lid));
    const name = parseLessonTitle(l.title).name;
    const title = buildLessonTitle(i + 1, name);
    return { updateOne: { filter: { _id: l._id }, update: { $set: { number: i + 1, order: i + 1, title, slug: slugify(title) } } } };
  }));
  await audit.log({ actor, action: 'course.reorder', entity: 'category', entityId: categoryId, after: { lessonIds } });
  return Lesson.find({ categoryId, number: { $gte: 0 }, status: { $ne: CS.REMOVED } }).sort({ number: 1 }).lean();
}
/** Start Here (flat): plain ordering. */
export async function reorderFlat(categoryId, lessonIds, actor) {
  await Lesson.bulkWrite(lessonIds.map((lid, i) => ({ updateOne: { filter: { _id: lid, categoryId }, update: { $set: { order: i } } } })));
  await audit.log({ actor, action: 'lessons.reorder', entity: 'category', entityId: categoryId, after: { lessonIds } });
}

// ---------------- captions ----------------
export async function addCaption(id, { srclang, label, vtt }, actor) {
  const { lesson } = await ctx(id);
  if (!lesson.bunnyVideoId) throw ApiError.conflict('Upload the video before adding captions');
  await stream.addCaption(lesson.bunnyVideoId, srclang, label, vtt);
  lesson.captions = [...(lesson.captions || []).filter((c) => c.srclang !== srclang), { srclang, label }];
  await lesson.save();
  await audit.log({ actor, action: 'lesson.caption-add', entity: 'lesson', entityId: id, after: { srclang } });
  return lesson.captions;
}
export async function listCaptions(id) { return (await ctx(id)).lesson.captions || []; }
export async function removeCaption(id, srclang, actor) {
  const { lesson } = await ctx(id);
  if (lesson.bunnyVideoId) await stream.deleteCaption(lesson.bunnyVideoId, srclang);
  lesson.captions = (lesson.captions || []).filter((c) => c.srclang !== srclang);
  await lesson.save();
  await audit.log({ actor, action: 'lesson.caption-remove', entity: 'lesson', entityId: id, after: { srclang } });
  return lesson.captions;
}
export async function progressCount(lessonId) { return Progress.countDocuments({ lessonId, completed: true }); }
export { WELCOME_TITLE };
