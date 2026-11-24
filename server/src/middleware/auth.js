const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Validates session JWT from httpOnly cookie or Authorization header.
 * Ensures the user still exists and hasn't changed their password since the token was issued.
 */
const protect = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check httpOnly cookie first
    if (req.cookies && req.cookies.medsync_token) {
      token = req.cookies.medsync_token;
    }
    // 2. Fall back to Authorization Bearer header if provided
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please log in.',
      });
    }

    // 3. Verify JWT signature & expiration
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured on the server');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        error: 'Your session has expired or is invalid. Please log in again.',
      });
    }

    // 4. Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'The user belonging to this session no longer exists.',
      });
    }

    // 5. Check if password changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        error: 'Password was recently changed. Please log in again with your new password.',
      });
    }

    // Grant access: attach user to request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
};
