const express = require('express');
const router = express.Router();

const doctorController = require('../controllers/doctorController');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * Doctor Discovery & Aggregation Routes
 */

// Search registered doctors by name or email
router.get('/search', protect, doctorController.searchDoctors);

// Get doctors visited aggregated from patient's reports (Patient only)
router.get('/visited', protect, requireRole('patient'), doctorController.getDoctorsVisited);

module.exports = router;
