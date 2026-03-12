const express = require('express');
const LeaveController = require('../controllers/LeaveController');
const authMiddleware = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');

const router = express.Router();

router.use(authMiddleware);
router.post('/', LeaveController.create);
router.get('/mine', LeaveController.getMine);
router.get('/', requireRoles(['admin', 'director']), LeaveController.getAll);
router.put('/:id/review', requireRoles(['admin', 'director']), LeaveController.review);
router.put('/:id/reschedule', requireRoles(['admin', 'director']), LeaveController.reschedule);

module.exports = router;
