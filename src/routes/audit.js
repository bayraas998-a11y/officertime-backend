const express = require('express');
const AuditController = require('../controllers/AuditController');
const auth = require('../middleware/auth');

const router = express.Router();

// Protect all audit endpoints
router.use(auth);

// Audit Logs
router.get('/', AuditController.getAuditLogs);
router.get('/trail', AuditController.getAuditTrail);
router.get('/user/:userId', AuditController.getUserActivity);
router.get('/report', AuditController.getAuditReport);
router.get('/resource', AuditController.getResourceHistory);

module.exports = router;
