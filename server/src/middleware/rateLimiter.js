const rateLimit = require('express-rate-limit');

/**
 * Standard JSON response handler for rate limiting
 */
const rateLimitHandler = (message) => (req, res) => {
  res.status(429).json({
    error: 'Too Many Requests',
    message: message || 'Too many requests, please slow down and try again later.',
  });
};

/**
 * Global API rate limiter
 * Allows 200 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many requests from this IP address, please try again in 15 minutes.'),
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Strict Rate Limiter for Authentication endpoints (Register / Login)
 * 15 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many authentication attempts. Please wait 15 minutes before trying again.'),
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Rate Limiter for Gemini AI calls (Autofill and Summary generation)
 * 20 calls per 15 minutes per IP/User
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  },
  handler: rateLimitHandler('AI service rate limit reached. Please wait a few moments before submitting another request.'),
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = {
  globalLimiter,
  authLimiter,
  aiLimiter,
};
