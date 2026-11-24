const mongoose = require('mongoose');

/**
 * Share Schema for MedSync
 * Allows patients to grant time-limited access to selected medical reports to registered doctors.
 * Utilizes a MongoDB TTL index for automatic deletion upon expiration,
 * while controllers strictly check expiresAt on every read to prevent access during TTL sweep latency.
 */
const shareSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor ID is required'],
      index: true,
    },
    reportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report',
        required: true,
      },
    ],
    expiresAt: {
      type: Date,
      required: [true, 'Expiration timestamp is required'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    openedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: MongoDB automatically purges expired share documents
shareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for querying active doctor inbox items
shareSchema.index({ doctor: 1, expiresAt: 1 });

const Share = mongoose.model('Share', shareSchema);

module.exports = Share;
