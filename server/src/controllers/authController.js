const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Generate JWT and attach it to httpOnly cookie
 * @param {import('express').Response} res
 * @param {User} user
 * @returns {string} token
 */
const generateTokenAndSetCookie = (res, user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured on the server');
  }

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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });

  return token;
};

/**
 * Register a new Patient or Doctor
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const {
      role,
      name,
      email,
      password,
      guardianPhone,
      department,
      yearsOfExperience,
      phone,
    } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email address already exists.',
      });
    }

    // Securely hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // Build user document according to role
    const userData = {
      role,
      name,
      email: email.toLowerCase(),
      passwordHash,
      theme: 'light',
    };

    if (role === 'patient') {
      userData.guardianPhone = guardianPhone || '';
    } else if (role === 'doctor') {
      userData.department = department || '';
      userData.yearsOfExperience = Number(yearsOfExperience) || 0;
      userData.phone = phone || '';
    }

    const user = await User.create(userData);

    // Issue httpOnly session cookie
    const token = generateTokenAndSetCookie(res, user);

    res.status(201).json({
      message: 'Account created successfully',
      user,
      token, // Also return token in response for non-browser/test clients
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate user & issue session cookie
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by normalized email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Enforce uniform generic error for wrong email or wrong password to prevent user enumeration
    if (!user || !(await user.isPasswordValid(password))) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Set httpOnly cookie
    const token = generateTokenAndSetCookie(res, user);

    res.status(200).json({
      message: 'Login successful',
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log out user & invalidate cookie
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('medsync_token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    expires: new Date(0), // Instantly expire cookie
  });

  res.status(200).json({
    message: 'Logged out successfully',
  });
};

/**
 * Get currently authenticated user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.status(200).json({
    user: req.user,
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
