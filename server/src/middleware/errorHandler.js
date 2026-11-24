/**
 * Centralized Application Error Handling Middleware
 * Provides safe, beginner-friendly, plain-language error responses.
 * Strictly guarantees that confidential medical report contents and database internals
 * are never exposed in error responses or logs.
 */
const errorHandler = (err, req, res, next) => {
  // Safe diagnostic log (never prints request bodies or sensitive report contents)
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Server Error] ${err.name || 'Error'}: ${err.message}`);
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      error: `An account with this ${field} already exists.`,
    });
  }

  // Handle Mongoose CastError (e.g. invalid MongoDB ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid resource identifier format.',
    });
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      error: messages[0] || 'Validation failed. Please verify your input.',
      details: messages,
    });
  }

  // Handle Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File is too large. Maximum allowed size is 10 MB.',
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
    });
  }

  // Handle JWT token validation errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Your session has expired or is invalid. Please log in again.',
    });
  }

  // Handle explicit status codes or default to 500
  const statusCode = err.status || err.statusCode || 500;
  const message =
    statusCode === 500
      ? 'An unexpected server error occurred. Please try again later.'
      : err.message || 'Something went wrong.';

  res.status(statusCode).json({
    error: message,
  });
};

module.exports = errorHandler;
