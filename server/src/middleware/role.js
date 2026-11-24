/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts route access to specified roles (e.g. 'patient' or 'doctor').
 * @param {...string} allowedRoles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to view or modify this resource.',
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
};
