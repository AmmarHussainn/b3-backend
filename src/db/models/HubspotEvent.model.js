import mongoose from 'mongoose';
import { SYNC_ACTIONS } from '../../config/constants.js';

const schema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true }, // idempotency key
    action: { type: String, enum: Object.values(SYNC_ACTIONS), required: true },
    email: { type: String, lowercase: true, index: true },
    hubspotContactId: String,
    payload: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ['received', 'processing', 'done', 'failed'], default: 'received', index: true },
    attempts: { type: Number, default: 0 },
    error: String,
    processedAt: Date,
  },
  { timestamps: true },
);

export const HubspotEvent = mongoose.models.HubspotEvent || mongoose.model('HubspotEvent', schema);
