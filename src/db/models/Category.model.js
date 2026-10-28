import mongoose from 'mongoose';
import { CONTENT_STATUS } from '../../config/constants.js';

// Same object, two jobs: a YEAR in the replay archive, a COURSE in training.
const schema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    kind: { type: String, enum: ['year', 'course'], required: true },
    title: { type: String, required: true }, // "2026" or "Course 3 - The Vital Signs"
    slug: { type: String, required: true },
    description: String,
    year: Number, // replays
    courseNumber: Number, // training
    order: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.DRAFT },
    archivedAt: Date,
  },
  { timestamps: true },
);
schema.index({ productId: 1, slug: 1 }, { unique: true });

export const Category = mongoose.models.Category || mongoose.model('Category', schema);
