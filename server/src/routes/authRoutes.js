const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateBody, registerSchema, loginSchema } = require('../utils/validation');

/**
 * Authentication Routes
 */
router.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  authController.register
);

router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  authController.login
);

router.post('/logout', authController.logout);

router.get('/me', protect, authController.getMe);

module.exports = router;
