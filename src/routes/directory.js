const express = require('express');
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/employees', authMiddleware, async (req, res) => {
  try {
    // Minimal directory for pickers (meetings/task assignment UI).
    const rows = await Employee.getDirectory();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

