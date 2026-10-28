import mongoose from 'mongoose';
import { CONTENT_STATUS } from '../../config/constants.js';

// A resource keeps a stable id. Replacing a file adds a version, so lessons never break and nothing is rebuilt.
const versionSchema = new mongoose.Schema(
  {
    n: { type: Number, required: true },
    fileName: { type: String, required: true }, // b3-topic-assettype-vN.ext
    storagePath: { type: String, required: true },
    sizeBytes: Number,
    mimeType: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    title: { type: String, required: true },
    assetType: { type: String, enum: ['docx', 'xlsx', 'pptx', 'pdf', 'image'], required: true },
    topic: String,
    versions: [versionSchema],
    currentVersion: { type: Number, default: 1 },
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.LIVE },
  },
  { timestamps: true },
);
schema.index({ title: 'text', topic: 'text' });

export const Resource = mongoose.models.Resource || mongoose.model('Resource', schema);
