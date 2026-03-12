const { normalizeRole } = require('../utils/role');

const requireRoles = (allowedRoles = []) => {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    const userRole = normalizeRole(req.employee?.role);
    if (normalizedAllowed.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ message: 'Эрх хүрэхгүй байна.' });
  };
};

module.exports = {
  requireRoles,
};
