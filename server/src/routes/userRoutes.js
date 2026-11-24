const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const {
  validateBody,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} = require('../utils/validation');

/**
 * User Profile & Account Management Routes
 */
router.patch(
  '/me',
  protect,
  validateBody(updateProfileSchema),
  userController.updateProfile
);

router.patch(
  '/me/password',
  protect,
  validateBody(changePasswordSchema),
  userController.changePassword
);

router.delete(
  '/me',
  protect,
  validateBody(deleteAccountSchema),
  userController.deleteAccount
);

module.exports = router;
