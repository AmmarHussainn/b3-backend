// Downloadable files. A resource keeps a stable id; replacing a file adds a version, so lessons never break.
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { Resource, Lesson } from '../db/models/index.js';
import { ALLOWED_FILE_TYPES, CONTENT_STATUS as CS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { pageParams } from '../utils/pagination.js';
import { parseFileName } from '../utils/naming.js';
import * as storage from '../integrations/bunny/storage.client.js';
import { currentVersion } from './content.service.js';
import * as audit from './audit.service.js';
import { logger } from '../utils/logger.js';

const SIGS = { zip: [0x50, 0x4b], pdf: [0x25, 0x50, 0x44, 0x46], png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff] };
const sigOf = { docx: 'zip', xlsx: 'zip', pptx: 'zip', pdf: 'pdf', png: 'png', jpg: 'jpg' };
const assetTypeOf = (ext) => (['png', 'jpg'].includes(ext) ? 'image' : ext);

/** name + extension + magic bytes. A renamed .exe is not accepted. */
function checkFile(file, expectedVersion) {
  if (!file) throw ApiError.badRequest('Attach a file in the "file" field');
  const parsed = parseFileName(file.originalname, expectedVersion);
  if (!ALLOWED_FILE_TYPES[parsed.ext]) throw ApiError.validation(`.${parsed.ext} files are not allowed`);
  const sig = SIGS[sigOf[parsed.ext]];
  if (!sig.every((b, i) => file.buffer[i] === b)) throw ApiError.validation(`The file content is not a valid .${parsed.ext}`);
  return parsed;
}
const pathFor = (id, n, fileName) => `resources/${id}/v${n}/${fileName}`;

export async function create(file, { lessonId, title, topic }, actor) {
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) throw ApiError.notFound('Lesson not found');
  const parsed = checkFile(file, 1);
  const _id = new mongoose.Types.ObjectId();
  const storagePath = pathFor(_id, 1, file.originalname);
  await storage.put(storagePath, file.buffer, ALLOWED_FILE_TYPES[parsed.ext]);
  try {
    const r = await Resource.create({
      _id, lessonId, productId: lesson.productId, title, topic, assetType: assetTypeOf(parsed.ext), currentVersion: 1, status: CS.LIVE,
      versions: [{ n: 1, fileName: file.originalname, storagePath, sizeBytes: file.size, mimeType: ALLOWED_FILE_TYPES[parsed.ext], uploadedBy: actor?.id }],
    });
    await audit.log({ actor, action: 'resource.create', entity: 'resource', entityId: r._id, after: { title, lessonId, fileName: file.originalname } });
    return r;
  } catch (e) { await storage.remove(storagePath).catch(() => {}); throw e; }
}

/** Replace a file: new version, same resource id, same lesson. The old version is kept for rollback. */
export async function addVersion(id, file, actor) {
  const r = await Resource.findById(id);
  if (!r || r.status === CS.REMOVED) throw ApiError.notFound('Resource not found');
  const n = Math.max(...r.versions.map((v) => v.n)) + 1;
  const parsed = checkFile(file, n);
  if (assetTypeOf(parsed.ext) !== r.assetType) throw ApiError.validation(`A replacement must be the same type (${r.assetType})`);
  const storagePath = pathFor(r._id, n, file.originalname);
  await storage.put(storagePath, file.buffer, ALLOWED_FILE_TYPES[parsed.ext]);
  r.versions.push({ n, fileName: file.originalname, storagePath, sizeBytes: file.size, mimeType: ALLOWED_FILE_TYPES[parsed.ext], uploadedBy: actor?.id });
  r.currentVersion = n;
  await r.save();
  await audit.log({ actor, action: 'resource.replace', entity: 'resource', entityId: id, after: { version: n, fileName: file.originalname } });
  return r;
}
export async function setCurrentVersion(id, n, actor) {
  const r = await Resource.findById(id);
  if (!r) throw ApiError.notFound('Resource not found');
  if (!r.versions.some((v) => v.n === n)) throw ApiError.badRequest(`Version ${n} does not exist`);
  const before = r.currentVersion; r.currentVersion = n; await r.save();
  await audit.log({ actor, action: 'resource.rollback', entity: 'resource', entityId: id, before: { version: before }, after: { version: n } });
  return r;
}
export async function update(id, { title, topic, lessonId }, actor) {
  const r = await Resource.findById(id);
  if (!r) throw ApiError.notFound('Resource not found');
  const before = { title: r.title, topic: r.topic, lessonId: String(r.lessonId) };
  if (title !== undefined) r.title = title;
  if (topic !== undefined) r.topic = topic;
  if (lessonId && String(lessonId) !== String(r.lessonId)) {
    const l = await Lesson.findById(lessonId).lean();
    if (!l) throw ApiError.notFound('Lesson not found');
    r.lessonId = l._id; r.productId = l.productId; // the same file is re-attached, nothing is copied
  }
  await r.save();
  await audit.log({ actor, action: 'resource.update', entity: 'resource', entityId: id, before, after: { title: r.title, topic: r.topic, lessonId: String(r.lessonId) } });
  return r;
}
export async function remove(id, actor) {
  const r = await Resource.findByIdAndUpdate(id, { $set: { status: CS.REMOVED } }, { new: true });
  if (!r) throw ApiError.notFound('Resource not found');
  await audit.log({ actor, action: 'resource.remove', entity: 'resource', entityId: id }); // files are kept in storage
  return r;
}
export async function get(id) {
  const r = await Resource.findById(id).lean();
  if (!r) throw ApiError.notFound('Resource not found');
  return r;
}
export async function list(q = {}) {
  const { page, limit, skip } = pageParams(q);
  const f = { status: q.status || { $ne: CS.REMOVED } };
  if (q.lessonId) f.lessonId = q.lessonId;
  if (q.productId) f.productId = q.productId;
  if (q.type) f.assetType = q.type;
  if (q.topic) f.topic = q.topic;
  if (q.q) f.title = new RegExp(String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([Resource.find(f).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(), Resource.countDocuments(f)]);
  return { items, total, page, limit };
}

// ---------- member delivery (callers must have checked access first) ----------
export function signedUrl(r) {
  const v = currentVersion(r);
  return { ...storage.signedDownloadUrl(v.storagePath, 300), fileName: v.fileName };
}
/** Streams the file with Content-Disposition: attachment so it always downloads instead of previewing. */
export async function pipeDownload(r, res) {
  const v = currentVersion(r);
  const upstream = await storage.download(v.storagePath);
  res.setHeader('Content-Type', v.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${v.fileName.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  const len = upstream.headers.get('content-length');
  if (len) res.setHeader('Content-Length', len);
  Readable.fromWeb(upstream.body).on('error', (e) => { logger.error({ err: e }, 'download stream error'); res.destroy(e); }).pipe(res);
}

// ---------------- GET /v1/admin/resources/:id/download-url ----------------
/** Short-lived signed CDN URL for the current version, or ?version=N for an older one. */
export async function adminDownloadUrl(id, version) {
  const r = await Resource.findById(id).lean();
  if (!r) throw ApiError.notFound('Resource not found');
  const v = version ? r.versions.find((x) => x.n === version) : r.versions.find((x) => x.n === r.currentVersion) || r.versions[r.versions.length - 1];
  if (!v) throw ApiError.notFound(`Version ${version} does not exist`);
  return { ...storage.signedDownloadUrl(v.storagePath, 300), fileName: v.fileName, version: v.n, current: v.n === r.currentVersion };
}
