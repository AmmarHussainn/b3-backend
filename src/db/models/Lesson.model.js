import mongoose from 'mongoose';
import { CONTENT_STATUS, VIDEO_STATUS } from '../../config/constants.js';

const schema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    number: Number, // training: 0 = welcome, 1..n
    description: { type: String, maxlength: 1200 },
    bunnyVideoId: String,
    videoStatus: { type: String, enum: Object.values(VIDEO_STATUS), default: VIDEO_STATUS.NONE },
    durationSeconds: Number,
    thumbnailUrl: String,
    captions: [{ srclang: String, label: String }],
    sessionDate: Date, // replays only: never set for training
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.DRAFT, index: true },
    publishedAt: Date,
    archivedAt: Date,
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
schema.index({ categoryId: 1, slug: 1 }, { unique: true });
schema.index({ title: 'text', description: 'text' });

export const Lesson = mongoose.models.Lesson || mongoose.model('Lesson', schema);
