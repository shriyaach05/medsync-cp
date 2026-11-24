const mongoose = require('mongoose');
const Share = require('../models/Share');
const Report = require('../models/Report');
const User = require('../models/User');
const gridFsService = require('../services/gridFsService');
const encryptionService = require('../services/encryptionService');

/**
 * Share Controller for MedSync
 * Handles time-limited doctor sharing, live inbox grouping, countdown calculations,
 * and decrypted streaming with strict TTL lag guard checks.
 */

const DURATION_PRESETS = {
  '1h': 1 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days max

/**
 * Create a new time-limited share granting a doctor access to selected reports
 * POST /api/shares
 */
const createShare = async (req, res, next) => {
  try {
    const { doctorId, reportIds, duration } = req.body;

    // Validate doctor recipient
    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ error: 'A valid doctor ID is required.' });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(400).json({
        error: 'The selected recipient must be a registered doctor.',
      });
    }

    // Validate reports list
    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        error: 'Please select at least one report to share.',
      });
    }

    // Security check: verify that all selected reports belong to the requesting patient
    const ownedReports = await Report.find({
      _id: { $in: reportIds },
      owner: req.user._id,
    });

    if (ownedReports.length !== reportIds.length) {
      return res.status(400).json({
        error: 'One or more selected reports do not belong to your account.',
      });
    }

    // Calculate duration in milliseconds
    let durationMs = DURATION_PRESETS['24h']; // default 24h

    if (typeof duration === 'string' && DURATION_PRESETS[duration]) {
      durationMs = DURATION_PRESETS[duration];
    } else if (typeof duration === 'number' && duration > 0) {
      durationMs = Math.min(duration, MAX_DURATION_MS);
    } else if (typeof duration === 'string' && !isNaN(Number(duration))) {
      durationMs = Math.min(Number(duration), MAX_DURATION_MS);
    }

    if (durationMs > MAX_DURATION_MS) {
      return res.status(400).json({
        error: 'Access duration cannot exceed 30 days.',
      });
    }

    const expiresAt = new Date(Date.now() + durationMs);

    // Create share record
    const share = await Share.create({
      patient: req.user._id,
      doctor: doctorId,
      reportIds,
      expiresAt,
    });

    res.status(201).json({
      message: 'Reports sent to doctor successfully.',
      share,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor Inbox: List all active shared reports grouped by patient with remaining countdown time
 * GET /api/shares/inbox
 */
const getDoctorInbox = async (req, res, next) => {
  try {
    const now = new Date();

    // Check expiresAt on every read (TTL deletion can lag by ~1 minute)
    const activeShares = await Share.find({
      doctor: req.user._id,
      expiresAt: { $gt: now },
    })
      .populate('patient', '_id name email guardianPhone')
      .populate({
        path: 'reportIds',
        select: '_id reason doctorName visitDate type file.originalName file.size',
      })
      .sort({ createdAt: -1 });

    // Group active shares by patient
    const patientMap = new Map();

    for (const share of activeShares) {
      if (!share.patient) continue;
      const patientId = share.patient._id.toString();

      if (!patientMap.has(patientId)) {
        patientMap.set(patientId, {
          patient: share.patient,
          shares: [],
        });
      }

      const timeRemainingMs = Math.max(0, share.expiresAt.getTime() - Date.now());

      patientMap.get(patientId).shares.push({
        _id: share._id,
        reports: share.reportIds,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        openedAt: share.openedAt,
        timeRemainingMs,
      });
    }

    const inbox = Array.from(patientMap.values());

    res.status(200).json({
      inbox,
      totalActiveShares: activeShares.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor File Stream: Decrypt and stream a shared PDF report if share is active and includes report
 * GET /api/shares/:shareId/reports/:reportId/file
 */
const getSharedReportFile = async (req, res, next) => {
  try {
    const { shareId, reportId } = req.params;

    const share = await Share.findById(shareId);
    if (!share) {
      return res.status(404).json({
        error: 'Share link not found or has expired.',
      });
    }

    // Enforce doctor ownership
    if (!share.doctor.equals(req.user._id)) {
      return res.status(403).json({
        error: 'Access denied. This share was not addressed to you.',
      });
    }

    // Strict expiration check on every read (TTL lag guard)
    if (share.expiresAt.getTime() <= Date.now()) {
      return res.status(403).json({
        error: 'Access expired. The time limit for viewing these reports has ended.',
      });
    }

    // Verify reportId is part of the shared package
    const includesReport = share.reportIds.some(
      (id) => id.toString() === reportId
    );
    if (!includesReport) {
      return res.status(404).json({
        error: 'This report is not part of the shared package.',
      });
    }

    // Record openedAt timestamp on first view
    if (!share.openedAt) {
      share.openedAt = new Date();
      await share.save();
    }

    // Fetch report metadata
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // 1. Download encrypted payload from GridFS
    const { encryptedBuffer, metadata } =
      await gridFsService.downloadEncryptedFile(report.file.gridFsId);

    // 2. Decrypt buffer with AES-256-GCM in memory (never logged)
    const decryptedPdf = encryptionService.decrypt(
      encryptedBuffer,
      metadata.iv,
      metadata.authTag
    );

    // 3. Stream decrypted PDF inline to doctor
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(report.file.originalName)}"`
    );
    res.setHeader('Content-Length', decryptedPdf.length);

    res.status(200).send(decryptedPdf);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createShare,
  getDoctorInbox,
  getSharedReportFile,
};
