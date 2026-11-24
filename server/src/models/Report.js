const mongoose = require('mongoose');

/**
 * Report Schema for MedSync
 * Stores metadata and pointers to AES-256-GCM encrypted PDF payloads in GridFS.
 */
const reportSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Report owner is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Visit reason is required'],
      maxlength: [120, 'Reason cannot exceed 120 characters'],
      trim: true,
    },
    doctorName: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      maxlength: [100, 'Doctor name cannot exceed 100 characters'],
    },
    visitDate: {
      type: Date,
      required: [true, 'Visit date is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['Lab report', 'Prescription', 'Imaging', 'Other'],
        message: 'Type must be Lab report, Prescription, Imaging, or Other',
      },
      required: [true, 'Report type is required'],
      index: true,
    },
    file: {
      gridFsId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      originalName: {
        type: String,
        required: true,
      },
      size: {
        type: Number,
        required: true,
      },
      encrypted: {
        type: Boolean,
        default: true,
      },
      mimeType: {
        type: String,
        default: 'application/pdf',
      },
    },
    summary: {
      type: Object,
      default: null,
    },
    summaryStatus: {
      type: String,
      enum: ['none', 'generating', 'completed', 'failed'],
      default: 'none',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for timeline queries grouped by patient and visit date
reportSchema.index({ owner: 1, visitDate: -1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
