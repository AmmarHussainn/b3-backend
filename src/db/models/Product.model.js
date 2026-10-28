import mongoose from 'mongoose';
import { CONTENT_STATUS, PRESENTATION } from '../../config/constants.js';

// A product/container is the smallest unit that can be granted or withheld. Name by topic, never by tier.
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    presentation: { type: String, enum: Object.values(PRESENTATION), required: true },
    navGroup: { type: String }, // e.g. both training containers share "b3 Growth System™ Training"
    order: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.LIVE },
  },
  { timestamps: true },
);

export const Product = mongoose.models.Product || mongoose.model('Product', schema);
