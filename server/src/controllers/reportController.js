const mongoose = require('mongoose');
const Report = require('../models/Report');
const pdfService = require('../services/pdfService');
const encryptionService = require('../services/encryptionService');
const gridFsService = require('../services/gridFsService');
const geminiService = require('../services/geminiService');

/**
 * Upload and encrypt a new medical report or prescription
 * POST /api/reports
 */
const createReport = async (req, res, next) => {
  try {
    const { reason, doctorName, visitDate, type } = req.body;

    // Validate fields
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Visit reason is required.' });
    }
    if (reason.length > 120) {
      return res.status(400).json({
        error: 'Visit reason cannot exceed 120 characters.',
      });
    }
    if (!doctorName || doctorName.trim().length === 0) {
      return res.status(400).json({ error: 'Doctor name is required.' });
    }
    if (!visitDate || isNaN(new Date(visitDate).getTime())) {
      return res.status(400).json({ error: 'A valid visit date is required.' });
    }
    const validTypes = ['Lab report', 'Prescription', 'Imaging', 'Other'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Report type must be Lab report, Prescription, Imaging, or Other.',
      });
    }

    // Retrieve uploaded files (single file or multi-photo array)
    const files = req.files && req.files.length > 0 ? req.files : req.file ? [req.file] : [];
    if (files.length === 0) {
      return res.status(400).json({
        error: 'Please upload a medical report file or take photos to attach.',
      });
    }

    // 1. Normalize all inputs into a standard PDF Buffer using sharp & pdf-lib
    const { pdfBuffer, filename } = await pdfService.normalizeToPdf(files);

    // 2. Encrypt the PDF Buffer with AES-256-GCM
    const { encryptedBuffer, iv, authTag } = encryptionService.encrypt(pdfBuffer);

    // 3. Persist the encrypted buffer into MongoDB GridFS
    const gridFsId = await gridFsService.uploadEncryptedFile(encryptedBuffer, filename, {
      iv,
      authTag,
      owner: req.user._id,
      originalSize: pdfBuffer.length,
      mimeType: 'application/pdf',
    });

    // 4. Save metadata record to MongoDB
    const report = await Report.create({
      owner: req.user._id,
      reason: reason.trim(),
      doctorName: doctorName.trim(),
      visitDate: new Date(visitDate),
      type,
      file: {
        gridFsId,
        originalName: filename,
        size: pdfBuffer.length,
        encrypted: true,
        mimeType: 'application/pdf',
      },
      summaryStatus: 'none',
    });

    res.status(201).json({
      message: 'Report uploaded and encrypted successfully.',
      report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List patient's reports grouped by month (newest first)
 * GET /api/reports
 */
const listReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ owner: req.user._id }).sort({
      visitDate: -1,
      createdAt: -1,
    });

    // Group reports by month (YYYY-MM)
    const groupsMap = new Map();

    for (const report of reports) {
      const date = new Date(report.visitDate);
      const year = date.getFullYear();
      const monthNum = String(date.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${monthNum}`;

      const displayMonth = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      if (!groupsMap.has(monthKey)) {
        groupsMap.set(monthKey, {
          month: monthKey,
          displayMonth,
          reports: [],
        });
      }

      groupsMap.get(monthKey).reports.push(report);
    }

    const timeline = Array.from(groupsMap.values());

    res.status(200).json({
      timeline,
      totalCount: reports.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch, decrypt, and stream a report PDF
 * GET /api/reports/:id/file
 */
const getReportFile = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const isOwner = report.owner.equals(req.user._id);

    if (!isOwner) {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to view this file.',
      });
    }

    // 1. Download encrypted payload and encryption metadata from GridFS
    const { encryptedBuffer, metadata } =
      await gridFsService.downloadEncryptedFile(report.file.gridFsId);

    // 2. Decrypt buffer with AES-256-GCM using IV and authentication tag
    const decryptedPdf = encryptionService.decrypt(
      encryptedBuffer,
      metadata.iv,
      metadata.authTag
    );

    // 3. Stream decrypted PDF inline to the client
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

/**
 * Permanently delete a report and its encrypted GridFS chunks
 * DELETE /api/reports/:id
 */
const deleteReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    if (!report.owner.equals(req.user._id)) {
      return res.status(403).json({
        error: 'Access denied. You do not own this report.',
      });
    }

    // 1. Delete GridFS encrypted file chunks
    if (report.file && report.file.gridFsId) {
      await gridFsService.deleteFile(report.file.gridFsId);
    }

    // 2. Pull report reference from any active shares
    const db = mongoose.connection.db;
    if (db) {
      await db
        .collection('shares')
        .updateMany({ reportIds: report._id }, { $pull: { reportIds: report._id } });
    }

    // 3. Delete Report metadata document
    await Report.findByIdAndDelete(report._id);

    res.status(200).json({
      message: 'Report deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI Autofill Endpoint: Normalizes uploaded file/photos to PDF and extracts form fields via Gemini
 * POST /api/reports/autofill
 */
const autofillReport = async (req, res, next) => {
  try {
    const files = req.files && req.files.length > 0 ? req.files : req.file ? [req.file] : [];
    if (files.length === 0) {
      return res.status(400).json({
        error: 'Please upload a medical report file or take a photo to autofill fields.',
      });
    }

    // 1. Convert uploaded file/images to standard PDF buffer
    const { pdfBuffer } = await pdfService.normalizeToPdf(files);

    // 2. Feed PDF to Gemini for field extraction
    const autofill = await geminiService.extractAutofill(pdfBuffer);

    // Per brief: If autofill fails, form is left empty with no error popup.
    const hasData = Boolean(
      (autofill.reason && autofill.reason !== '') ||
      (autofill.doctorName && autofill.doctorName !== 'Unknown') ||
      autofill.visitDate
    );

    res.status(200).json({
      success: true,
      autofill,
      message: hasData ? 'Filled automatically, please check.' : '',
    });
  } catch (error) {
    // Return empty fields gracefully without breaking the client form popup
    res.status(200).json({
      success: false,
      autofill: {
        reason: '',
        doctorName: '',
        visitDate: null,
        type: 'Other',
      },
      message: '',
    });
  }
};

/**
 * AI Summary Endpoint: Generates or fetches simple-language medical report summary via Gemini
 * POST /api/reports/:id/summary
 */
const generateSummary = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Check ownership
    if (!report.owner.equals(req.user._id)) {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to view this report.',
      });
    }

    // If summary is already generated, return instantly (cache)
    if (report.summary && report.summaryStatus === 'completed') {
      return res.status(200).json({
        summary: report.summary,
        cached: true,
        disclaimer: 'AI summary, not medical advice. Check the original with your doctor.',
      });
    }

    // Mark as generating
    report.summaryStatus = 'generating';
    await report.save();

    try {
      // 1. Fetch encrypted PDF payload from GridFS
      const { encryptedBuffer, metadata } =
        await gridFsService.downloadEncryptedFile(report.file.gridFsId);

      // 2. Decrypt in memory (never logged)
      const decryptedPdf = encryptionService.decrypt(
        encryptedBuffer,
        metadata.iv,
        metadata.authTag
      );

      // 3. Request Gemini structured summary
      const summary = await geminiService.generateReportSummary(decryptedPdf);

      // 4. Save summary in report document
      report.summary = summary;
      report.summaryStatus = 'completed';
      await report.save();

      res.status(200).json({
        summary: report.summary,
        cached: false,
        disclaimer: 'AI summary, not medical advice. Check the original with your doctor.',
      });
    } catch (genErr) {
      report.summaryStatus = 'failed';
      await report.save();
      return res.status(502).json({
        error: 'Unable to generate AI summary at this time. Please check the original document.',
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  listReports,
  getReportFile,
  deleteReport,
  autofillReport,
  generateSummary,
};
