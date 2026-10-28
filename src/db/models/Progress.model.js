import mongoose from 'mongoose';

// Keyed by lessonId so archiving or moving content never loses completion history.
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    completed: { type: Boolean, default: false },
    completedAt: Date,
    positionSeconds: { type: Number, default: 0 },
  },
  { timestamps: true },
);
schema.index({ userId: 1, lessonId: 1 }, { unique: true });

export const Progress = mongoose.models.Progress || mongoose.model('Progress', schema);
