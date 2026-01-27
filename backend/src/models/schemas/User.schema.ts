// backend/src/models/schemas/User.schema.ts

import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * USER SCHEMA
 *
 * Purpose:
 * - User authentication (JWT)
 * - Role-based access control (RBAC)
 * - Multi-tenant support
 *
 * Roles:
 * - admin        → Full system access
 * - accountant   → Approve transactions, view reports
 * - user         → Upload receipts, view own data
 * - dev          → Access dev APIs (in DEV mode only)
 *
 * References:
 * - Vol2 Section 7 - Authentication & Authorization
 */

export interface IUser extends Document {
  // ===========================
  // IDENTITY
  // ===========================
  email: string;
  passwordHash: string;

  name: string;

  // ===========================
  // AUTHORIZATION
  // ===========================
  role: 'admin' | 'accountant' | 'user' | 'dev';

  clientId?: mongoose.Types.ObjectId;  // Which client they belong to (null for admin)

  // ===========================
  // STATUS
  // ===========================
  isActive: boolean;                   // Can login?
  isEmailVerified: boolean;

  lastLoginAt?: Date;
  lastLoginIp?: string;

  // ===========================
  // SECURITY
  // ===========================
  failedLoginAttempts: number;
  lockedUntil?: Date;                  // Account lockout (brute-force protection)

  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // ===========================
  // AUDIT
  // ===========================
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId; // Who created this user

  // ===========================
  // METHODS
  // ===========================
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<void>;
  isLocked(): boolean;
}

const UserSchema = new Schema<IUser>(
  {
    // IDENTITY
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,  // Don't return in queries by default
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },

    // AUTHORIZATION
    role: {
      type: String,
      enum: ['admin', 'accountant', 'user', 'dev'],
      default: 'user',
      required: true,
      index: true,
    },

    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },

    // STATUS
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: Date,
    lastLoginIp: String,

    // SECURITY
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: Date,

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    // AUDIT
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// ===========================
// INDEXES
// ===========================

// Login lookup
UserSchema.index({ email: 1 });

// Role-based queries
UserSchema.index({ role: 1, isActive: 1 });

// Client's users
UserSchema.index({ clientId: 1, isActive: 1 });

// ===========================
// HOOKS (Middleware)
// ===========================

/**
 * Pre-save: Hash password if modified
 */
UserSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (error) {
    next(error as Error);
  }
});

// ===========================
// METHODS
// ===========================

/**
 * Compare password with hash
 */
UserSchema.methods.comparePassword = async function(
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Increment failed login attempts (with lockout)
 */
UserSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 15 * 60 * 1000;  // 15 minutes

  // Reset if lock expired
  if (this.lockedUntil && this.lockedUntil < new Date()) {
    this.failedLoginAttempts = 0;
    this.lockedUntil = undefined;
  }

  this.failedLoginAttempts += 1;

  // Lock account if max attempts reached
  if (this.failedLoginAttempts >= MAX_ATTEMPTS) {
    this.lockedUntil = new Date(Date.now() + LOCK_TIME);
  }

  await this.save();
};

/**
 * Check if account is locked
 */
UserSchema.methods.isLocked = function(): boolean {
  return !!(this.lockedUntil && this.lockedUntil > new Date());
};

export default mongoose.model<IUser>('User', UserSchema);