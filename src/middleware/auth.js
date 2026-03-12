const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const { normalizeRole } = require('../utils/role');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Нэвтрэх эрхгүй байна. Дахин нэвтэрч орно уу.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const dbEmployee = await Employee.getById(decoded.id);
    const role = normalizeRole(decoded.role || dbEmployee?.position);

    req.employee = {
      ...decoded,
      role,
      position: dbEmployee?.position || decoded.position || null,
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Нэвтрэх эрх хүчингүй байна. Дахин нэвтэрч орно уу.' });
  }
};

module.exports = authMiddleware;
