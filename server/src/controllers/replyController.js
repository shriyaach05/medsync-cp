const mongoose = require('mongoose');
const Reply = require('../models/Reply');
const Share = require('../models/Share');
const Report = require('../models/Report');

/**
 * Reply Controller for MedSync
 * Doctors write a reply file (comment, prescription, follow-up, advice) to a record
 * a patient has shared with them. Patients read and can delete the replies they receive.
 */

const SECTION_FIELDS = ['comment', 'prescription', 'followUp', 'advice'];
const SECTION_LABELS = {
  comment: 'Comment',
  prescription: 'Prescription',
  followUp: 'Follow-up',
  advice: 'Advice',
};
const MAX_LENGTH = Reply.SECTION_MAX_LENGTH;

/**
 * Validate and normalise the four text sections from a request body.
 * Only sections present in the body are returned.
 */
const parseSections = (body) => {
  const values = {};
  for (const field of SECTION_FIELDS) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== 'string') {
      return { error: `${SECTION_LABELS[field]} must be text.` };
    }
    const trimmed = body[field].trim();
    if (trimmed.length > MAX_LENGTH) {
      return {
        error: `${SECTION_LABELS[field]} cannot exceed ${MAX_LENGTH} characters.`,
      };
    }
    values[field] = trimmed;
  }
  return { values };
};

const hasContent = (sections) =>
  SECTION_FIELDS.some((f) => typeof sections[f] === 'string' && sections[f].length > 0);

/**
 * Shape a reply for API output. `accessActive` tells the doctor whether the patient's
 * record can still be opened (share not expired yet).
 */
const serializeReply = (reply) => {
  const obj = reply.toObject ? reply.toObject() : reply;
  return {
    ...obj,
    accessActive: obj.shareExpiresAt
      ? new Date(obj.shareExpiresAt).getTime() > Date.now()
      : false,
  };
};

/**
 * Doctor creates a reply file for a record shared with them
 * POST /api/replies
 */
const createReply = async (req, res, next) => {
  try {
    const { shareId, reportId } = req.body || {};

    if (!shareId || !mongoose.Types.ObjectId.isValid(shareId)) {
      return res.status(400).json({ error: 'A valid share ID is required.' });
    }
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ error: 'A valid report ID is required.' });
    }

    const { values, error } = parseSections(req.body);
    if (error) {
      return res.status(400).json({ error });
    }
    if (!hasContent(values)) {
      return res.status(400).json({
        error: 'Please write something in at least one section before sending.',
      });
    }

    const share = await Share.findById(shareId);
    if (!share) {
      return res.status(404).json({
        error: 'This shared record was not found or its access time has ended.',
      });
    }

    if (!share.doctor.equals(req.user._id)) {
      return res.status(403).json({
        error: 'Access denied. This share was not addressed to you.',
      });
    }

    // Strict expiry check on every write (TTL deletion can lag by ~1 minute)
    if (share.expiresAt.getTime() <= Date.now()) {
      return res.status(403).json({
        error: 'Access expired. You can no longer reply to this record.',
      });
    }

    const includesReport = share.reportIds.some((id) => id.toString() === reportId);
    if (!includesReport) {
      return res.status(404).json({
        error: 'This report is not part of the shared package.',
      });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const existing = await Reply.findOne({
      share: share._id,
      report: report._id,
      doctor: req.user._id,
    });
    if (existing) {
      return res.status(409).json({
        error: 'You have already replied to this record. Please edit your existing reply instead.',
        replyId: existing._id,
      });
    }

    const reply = await Reply.create({
      patient: share.patient,
      doctor: req.user._id,
      report: report._id,
      share: share._id,
      reportReason: report.reason,
      reportType: report.type,
      reportVisitDate: report.visitDate,
      shareExpiresAt: share.expiresAt,
      comment: values.comment || '',
      prescription: values.prescription || '',
      followUp: values.followUp || '',
      advice: values.advice || '',
    });

    res.status(201).json({
      message: 'Reply sent to the patient successfully.',
      reply: serializeReply(reply),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: list every reply they have sent (newest edits first)
 * GET /api/replies/sent
 */
const getSentReplies = async (req, res, next) => {
  try {
    const replies = await Reply.find({ doctor: req.user._id })
      .populate('patient', '_id name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      replies: replies.filter((r) => r.patient).map(serializeReply),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor edits a reply they previously sent
 * PATCH /api/replies/:id
 */
const updateReply = async (req, res, next) => {
  try {
    const reply = await Reply.findById(req.params.id);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    if (!reply.doctor.equals(req.user._id)) {
      return res.status(403).json({
        error: 'Access denied. You did not write this reply.',
      });
    }

    const { values, error } = parseSections(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }
    if (Object.keys(values).length === 0) {
      return res.status(400).json({ error: 'No changes were provided.' });
    }

    const merged = {};
    for (const field of SECTION_FIELDS) {
      merged[field] = values[field] !== undefined ? values[field] : reply[field] || '';
    }
    if (!hasContent(merged)) {
      return res.status(400).json({
        error: 'A reply must contain at least one section with text.',
      });
    }

    for (const field of SECTION_FIELDS) {
      reply[field] = merged[field];
    }
    await reply.save();

    res.status(200).json({
      message: 'Reply updated successfully.',
      reply: serializeReply(reply),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient: list every reply doctors have sent them
 * GET /api/replies
 */
const getPatientReplies = async (req, res, next) => {
  try {
    const replies = await Reply.find({ patient: req.user._id })
      .populate('doctor', '_id name department')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      replies: replies.filter((r) => r.doctor).map(serializeReply),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient deletes a reply they received
 * DELETE /api/replies/:id
 */
const deleteReply = async (req, res, next) => {
  try {
    const reply = await Reply.findById(req.params.id);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    if (!reply.patient.equals(req.user._id)) {
      return res.status(403).json({
        error: 'Access denied. This reply was not sent to you.',
      });
    }

    await Reply.findByIdAndDelete(reply._id);

    res.status(200).json({ message: 'Reply deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReply,
  getSentReplies,
  updateReply,
  getPatientReplies,
  deleteReply,
};
