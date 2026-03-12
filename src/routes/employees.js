const express = require('express');
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');
const { isLeaderRole } = require('../utils/role');

const router = express.Router();

// Admin/Director can view the active employee list.
// Admin can optionally include inactive/pending via ?include_inactive=1
router.get('/', authMiddleware, requireRoles(['admin', 'director']), async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive || '').trim() === '1';
    const employees = await Employee.getAll({
      includeInactive: includeInactive && String(req.employee?.role || '') === 'admin',
      includeArchived: false,
    });
    return res.json(employees);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Self or leader can view employee detail.
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const requestedId = Number(req.params.id);
    const isSelf = requestedId === Number(req.employee.id);
    if (!isSelf && !isLeaderRole(req.employee.role)) {
      return res.status(403).json({ message: 'Эрх хүрэхгүй байна.' });
    }

    const employee = await Employee.getById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй.' });
    }
    return res.json(employee);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Only admin can update/delete employees.
router.put('/:id', authMiddleware, requireRoles(['admin']), async (req, res) => {
  try {
    const employee = await Employee.update(req.params.id, req.body);
    return res.json(employee);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, requireRoles(['admin']), async (req, res) => {
  try {
    await Employee.delete(req.params.id);
    return res.json({ message: 'Ажилтны бүртгэлийг идэвхгүй болголоо.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
