const express = require('express');
const router = express.Router();

const shareController = require('../controllers/shareController');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * Report Sharing & Doctor Inbox Routes
 */

// Create a time-limited share with multiple reports (Patient only)
router.post(
  '/',
  protect,
  requireRole('patient'),
  shareController.createShare
);

// Doctor Inbox: List active shares grouped by patient with countdowns (Doctor only)
router.get(
  '/inbox',
  protect,
  requireRole('doctor'),
  shareController.getDoctorInbox
);

// Doctor File Access: Decrypt and stream a shared report PDF (Doctor only)
router.get(
  '/:shareId/reports/:reportId/file',
  protect,
  requireRole('doctor'),
  shareController.getSharedReportFile
);

module.exports = router;
