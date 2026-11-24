const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema for MedSync
 * Supports both Patients and Doctors with role-specific attributes,
 * secure password hashing, and token invalidation on password change.
 */
const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: {
        values: ['patient', 'doctor'],
        message: 'Role must be either "patient" or "doctor"',
      },
      required: [true, 'Role is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light',
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    // Patient-specific field
    guardianPhone: {
      type: String,
      trim: true,
      default: '',
    },
    // Doctor-specific fields
    department: {
      type: String,
      trim: true,
      default: '',
    },
    yearsOfExperience: {
      type: Number,
      min: [0, 'Years of experience cannot be negative'],
      default: 0,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true, // creates createdAt and updatedAt
  }
);

/**
 * Compare candidate plaintext password against stored bcrypt password hash
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordValid = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Check if user changed their password after a JWT token was issued
 * @param {number} JWTTimestamp - Token issuance timestamp in seconds
 * @returns {boolean} True if password was changed after token was issued
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * Clean JSON output: strips passwordHash and internal Mongoose __v
 */
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
