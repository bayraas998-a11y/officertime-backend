const express = require('express');
const Department = require('../models/Department');

const router = express.Router();

// Public: used on self-registration page.
router.get('/', async (req, res) => {
  try {
    const rows = await Department.getAllActive();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

