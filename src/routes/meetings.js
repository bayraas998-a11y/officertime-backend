const express = require('express');
const MeetingController = require('../controllers/MeetingController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, MeetingController.getMeetings);
router.post('/', authMiddleware, MeetingController.createMeeting);
router.put('/:id', authMiddleware, MeetingController.updateMeeting);
router.delete('/:id', authMiddleware, MeetingController.deleteMeeting);

module.exports = router;
