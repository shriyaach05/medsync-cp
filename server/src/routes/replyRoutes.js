const express = require('express');
const router = express.Router();

const replyController = require('../controllers/replyController');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * Doctor Reply Routes
 * Doctors reply to shared records (comment, prescription, follow-up, advice).
 * Patients read and delete the replies they receive.
 */

// Doctor: send a new reply file for a shared record
router.post('/', protect, requireRole('doctor'), replyController.createReply);

// Doctor: list the replies they have sent
router.get('/sent', protect, requireRole('doctor'), replyController.getSentReplies);

// Doctor: edit a reply they sent
router.patch('/:id', protect, requireRole('doctor'), replyController.updateReply);

// Patient: list replies received from doctors
router.get('/', protect, requireRole('patient'), replyController.getPatientReplies);

// Patient: delete a received reply
router.delete('/:id', protect, requireRole('patient'), replyController.deleteReply);

module.exports = router;
