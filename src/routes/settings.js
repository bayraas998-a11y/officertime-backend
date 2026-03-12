const express = require('express');
const SettingsController = require('../controllers/SettingsController');
const auth = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');

const router = express.Router();

router.use(auth);

router.get('/workplace', SettingsController.getWorkplace);
router.put('/workplace', requireRoles(['admin']), SettingsController.setWorkplace);

module.exports = router;

