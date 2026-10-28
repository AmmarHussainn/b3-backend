import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    actorType: { type: String, enum: ['admin', 'system', 'member'], required: true },
    actorId: mongoose.Schema.Types.ObjectId,
    actorEmail: String,
    action: { type: String, required: true, index: true },
    entity: String,
    entityId: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: 'at', updatedAt: false } },
);

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', schema);
