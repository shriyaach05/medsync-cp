const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getGridFSBucket } = require('../config/db');

/**
 * Update authenticated user profile
 * PATCH /api/users/me
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      name,
      email,
      theme,
      guardianPhone,
      department,
      yearsOfExperience,
      phone,
    } = req.body;

    // Check email uniqueness if email is being updated
    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(409).json({
          error: 'An account with this email address already exists.',
        });
      }
      user.email = email.toLowerCase();
    }

    if (name) user.name = name;
    if (theme) user.theme = theme;

    // Role-specific field updates
    if (user.role === 'patient') {
      if (guardianPhone !== undefined) user.guardianPhone = guardianPhone;
    } else if (user.role === 'doctor') {
      if (department !== undefined) user.department = department;
      if (yearsOfExperience !== undefined) user.yearsOfExperience = Number(yearsOfExperience);
      if (phone !== undefined) user.phone = phone;
    }

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change authenticated user password
 * PATCH /api/users/me/password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isCurrentValid = await user.isPasswordValid(currentPassword);
    if (!isCurrentValid) {
      return res.status(401).json({
        error: 'Current password is incorrect.',
      });
    }

    // Hash new password and update passwordChangedAt
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    // Re-issue new JWT session cookie so the user stays authenticated seamlessly
    const secret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: user._id, role: user.role },
      secret,
      { expiresIn: '7d' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('medsync_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Password changed successfully',
      passwordChangedAt: user.passwordChangedAt,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Permanently delete authenticated user account and all associated confidential data
 * DELETE /api/users/me
 */
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = req.user;

    // Verify password for destructive action
    const isPasswordValid = await user.isPasswordValid(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Incorrect password. Account deletion aborted.',
      });
    }

    const db = mongoose.connection.db;

    // Cascade deletion for Patient: delete patient reports, GridFS encrypted files, and shares
    if (user.role === 'patient') {
      if (db) {
        const reports = await db
          .collection('reports')
          .find({ owner: user._id })
          .toArray();

        // Safely remove GridFS file chunks
        try {
          const bucket = getGridFSBucket();
          for (const report of reports) {
            if (report.file && report.file.gridFsId) {
              await bucket.delete(report.file.gridFsId).catch(() => {});
            }
          }
        } catch (err) {
          // Continue deletion even if GridFS bucket is uninitialized
        }

        // Delete reports & shares
        await db.collection('reports').deleteMany({ owner: user._id });
        await db
          .collection('shares')
          .deleteMany({ $or: [{ patient: user._id }, { doctor: user._id }] });
      }
    } else if (user.role === 'doctor') {
      if (db) {
        // Remove doctor from active shares
        await db.collection('shares').deleteMany({ doctor: user._id });
      }
    }

    // Permanently remove User document
    await User.findByIdAndDelete(user._id);

    // Clear session cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('medsync_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      expires: new Date(0),
    });

    res.status(200).json({
      message: 'Account and all associated records permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  changePassword,
  deleteAccount,
};
