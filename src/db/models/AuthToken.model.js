import mongoose from 'mongoose';
import { TOKEN_TYPES } from '../../config/constants.js';

// invite / reset / refresh tokens. Only the SHA-256 hash is stored, never the token.
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userType: { type: String, enum: ['member', 'admin'], required: true },
    type: { type: String, enum: Object.values(TOKEN_TYPES), required: true },
    tokenHash: { type: String, required: true, unique: true },
    family: String, // refresh rotation chain, used for reuse detection
    expiresAt: { type: Date, required: true },
    usedAt: Date,
    replacedByHash: String,
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }); // purge a week after expiry

export const AuthToken = mongoose.models.AuthToken || mongoose.model('AuthToken', schema);
