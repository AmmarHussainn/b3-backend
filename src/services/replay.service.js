// b3 Growth Lab replays: year category derived from the session date; title built as "YYYY-MM Growth Lab - Topic".
import { Product, Category, Lesson, Resource } from '../db/models/index.js';
import { PRODUCT_KEYS, CONTENT_STATUS as CS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/slug.js';
import { parseDateOnly, publishDeadline, hoursBetween } from '../utils/dates.js';
import { buildReplayTitle } from '../utils/naming.js';
import * as audit from './audit.service.js';

const getProduct = async () => {
  const p = await Product.findOne({ key: PRODUCT_KEYS.GROWTH_LAB_REPLAYS }).lean();
  if (!p) throw ApiError.conflict('Run the seed first: the Growth Lab replays product does not exist');
  return p;
};
async function yearCategory(productId, year) {
  return Category.findOneAndUpdate(
    { productId, kind: 'year', slug: String(year) },
    { $setOnInsert: { title: String(year), year, order: -year, status: CS.LIVE } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function create({ sessionDate, topic, description }, actor) {
  const product = await getProduct();
  const date = parseDateOnly(sessionDate);
  const title = buildReplayTitle(date, topic);
  const cat = await yearCategory(product._id, date.getUTCFullYear());
  const slug = slugify(title);
  if (await Lesson.exists({ categoryId: cat._id, slug })) throw ApiError.conflict(`A replay called "${title}" already exists`);
  const lesson = await Lesson.create({ productId: product._id, categoryId: cat._id, title, slug, description, sessionDate: date, status: CS.DRAFT });
  await audit.log({ actor, action: 'replay.create', entity: 'lesson', entityId: lesson._id, after: { title } });
  return lesson;
}

export async function update(id, { sessionDate, topic, description }, actor) {
  const l = await Lesson.findById(id);
  const product = await getProduct();
  if (!l || String(l.productId) !== String(product._id)) throw ApiError.notFound('Replay not found');
  const before = { title: l.title, sessionDate: l.sessionDate };
  const date = sessionDate ? parseDateOnly(sessionDate) : l.sessionDate;
  const currentTopic = l.title.replace(/^\d{4}-\d{2} Growth Lab - /, '');
  const title = buildReplayTitle(date, topic ?? currentTopic);
  if (title !== l.title || String(date) !== String(l.sessionDate)) {
    const cat = await yearCategory(product._id, date.getUTCFullYear());
    const slug = slugify(title);
    if (await Lesson.exists({ _id: { $ne: l._id }, categoryId: cat._id, slug })) throw ApiError.conflict(`A replay called "${title}" already exists`);
    Object.assign(l, { title, slug, sessionDate: date, categoryId: cat._id });
  }
  if (description !== undefined) l.description = description;
  await l.save();
  await audit.log({ actor, action: 'replay.update', entity: 'lesson', entityId: id, before, after: { title: l.title, sessionDate: l.sessionDate } });
  return l;
}

/** Admin list: every year, newest first, drafts included. */
export async function listByYear() {
  const product = await getProduct();
  const [cats, lessons] = await Promise.all([
    Category.find({ productId: product._id, kind: 'year' }).sort({ year: -1 }).lean(),
    Lesson.find({ productId: product._id, status: { $ne: CS.REMOVED } }).sort({ sessionDate: -1 }).lean(),
  ]);
  const counts = new Map((await Resource.aggregate([{ $match: { productId: product._id, status: { $ne: CS.REMOVED } } }, { $group: { _id: '$lessonId', n: { $sum: 1 } } }])).map((r) => [String(r._id), r.n]));
  return cats.map((c) => ({
    id: String(c._id), year: c.year, title: c.title,
    replays: lessons.filter((l) => String(l.categoryId) === String(c._id)).map((l) => ({ ...l, attachmentCount: counts.get(String(l._id)) || 0, publishDeadline: publishDeadline(l.sessionDate), hoursToDeadline: l.status === CS.DRAFT ? Math.round(hoursBetween(new Date(), publishDeadline(l.sessionDate))) : null })),
  }));
}
