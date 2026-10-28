import mongoose from 'mongoose';
import { ADMIN_ROLES } from '../../config/constants.js';

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    firstName: String,
    lastName: String,
    passwordHash: { type: String, select: false },
    role: { type: String, enum: Object.values(ADMIN_ROLES), required: true },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true },
);

export const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminSchema);
