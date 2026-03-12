const express = require('express');
const ReportController = require('../controllers/ReportController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/employee', authMiddleware, ReportController.getEmployeeReport);
router.post('/pdf', authMiddleware, ReportController.generatePDFReport);
router.post('/excel', authMiddleware, ReportController.generateExcelReport);

module.exports = router;
