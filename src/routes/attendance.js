const express = require('express');
const AttendanceController = require('../controllers/AttendanceController');
const authMiddleware = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');

const router = express.Router();

router.post('/check-in', authMiddleware, AttendanceController.checkIn);
router.post('/check-out', authMiddleware, AttendanceController.checkOut);
router.post('/outside/start', authMiddleware, AttendanceController.startOutsideWork);
router.post('/outside/end', authMiddleware, AttendanceController.endOutsideWork);
router.get('/outside/active', authMiddleware, AttendanceController.getOutsideActive);
router.get('/outside/logs', authMiddleware, AttendanceController.getOutsideLogs);
router.put('/:id/outside-hours', authMiddleware, AttendanceController.updateOutsideWorkedHours);
router.get('/today', authMiddleware, AttendanceController.getTodayAttendance);
router.get('/history', authMiddleware, AttendanceController.getAttendanceReport);
// Personal stats (employee can view). Team-wide endpoints use /all.
router.get('/report', authMiddleware, AttendanceController.getAttendanceStats);
router.get('/all', authMiddleware, requireRoles(['admin', 'director']), AttendanceController.getAllAttendance);

module.exports = router;
