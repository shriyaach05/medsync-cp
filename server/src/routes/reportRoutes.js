const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const upload = require('../middleware/upload');

/**
 * Report Management Routes (Confidential Patient Medical Documents)
 */

// Upload & encrypt report (Patient only)
router.post(
  '/',
  protect,
  requireRole('patient'),
  upload.array('files', 10),
  reportController.createReport
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

// Delete report and encrypted GridFS file (Patient only)
router.delete(
  '/:id',
  protect,
  requireRole('patient'),
  reportController.deleteReport
);

module.exports = router;
