const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { aiLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

/**
 * Report Management & AI Analysis Routes
 */

// Upload & encrypt report (Patient only)
router.post(
  '/',
  protect,
  requireRole('patient'),
  upload.array('files', 10),
  reportController.createReport
);

// Autofill form fields from uploaded document using Gemini (Patient only)
router.post(
  '/autofill',
  protect,
  requireRole('patient'),
  aiLimiter,
  upload.array('files', 10),
  reportController.autofillReport
);

// List patient's reports grouped by month (Patient only)
router.get(
  '/',
  protect,
  requireRole('patient'),
  reportController.listReports
);

// Decrypt and stream PDF inline (Patient or authorized doctor)
router.get(
  '/:id/file',
  protect,
  reportController.getReportFile
);

// Generate or fetch cached AI summary table using Gemini
router.post(
  '/:id/summary',
  protect,
  aiLimiter,
  reportController.generateSummary
);

// Edit report details: reason, doctor, date, type (Patient only)
router.patch(
  '/:id',
  protect,
  requireRole('patient'),
  reportController.updateReport
);

// Delete report and encrypted GridFS file (Patient only)
router.delete(
  '/:id',
  protect,
  requireRole('patient'),
  reportController.deleteReport
);

module.exports = router;
