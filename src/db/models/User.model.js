import mongoose from 'mongoose';
import { USER_STATUS, TIER_TAGS } from '../../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // the single matching key
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    company: { type: String, trim: true },
    passwordHash: { type: String, select: false }, // empty until the client uses the invite link
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE, index: true },
    tags: { type: [String], default: [], index: true },
    tier: { type: String, enum: [...TIER_TAGS, null], default: null },
    hubspotContactId: { type: String, index: true, sparse: true },
    tokenVersion: { type: Number, default: 0 }, // bump to kill every issued token (revoke, password change)
    provisionedAt: Date,
    revokedAt: Date,
    welcomeEmailSentAt: Date, // makes the welcome email idempotent
    lastLoginAt: Date,
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
