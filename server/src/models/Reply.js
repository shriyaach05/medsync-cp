const mongoose = require('mongoose');

/**
 * Reply Schema for MedSync
 * A doctor's written reply to a patient's shared medical record. A reply is a small
 * "file" with four editable sections: comment, prescription, follow-up and advice.
 *
 * Shares are auto-deleted by a TTL index after they expire, so the few report
 * details needed to display a reply (reason, type, visit date, access expiry) are
 * copied onto the reply itself. This keeps replies readable after the share is gone,
 * while the patient's record file itself is never reachable once access has ended.
 */
const SECTION_MAX_LENGTH = 5000;

const sectionField = {
  type: String,
  default: '',
  trim: true,
  maxlength: [SECTION_MAX_LENGTH, `Each section cannot exceed ${SECTION_MAX_LENGTH} characters`],
};

const replySchema = new mongoose.Schema(
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
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      required: [true, 'Report ID is required'],
      index: true,
    },
    share: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Share',
      required: [true, 'Share ID is required'],
    },

    // Snapshot of the record this reply belongs to
    reportReason: { type: String, trim: true, maxlength: 120, default: '' },
    reportType: { type: String, trim: true, default: '' },
    reportVisitDate: { type: Date, default: null },
    shareExpiresAt: {
      type: Date,
      required: [true, 'Share expiry is required'],
    },

    // The four sections of the reply file
    comment: sectionField,
    prescription: sectionField,
    followUp: sectionField,
    advice: sectionField,
  },
  {
    timestamps: true,
  }
);

// One reply file per doctor per shared record (the doctor edits it afterwards)
replySchema.index({ share: 1, report: 1, doctor: 1 }, { unique: true });

const Reply = mongoose.model('Reply', replySchema);

Reply.SECTION_MAX_LENGTH = SECTION_MAX_LENGTH;

module.exports = Reply;
