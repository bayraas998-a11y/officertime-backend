const express = require('express');
const TaskController = require('../controllers/TaskController');
const authMiddleware = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');

const router = express.Router();

router.get('/', authMiddleware, TaskController.getEmployeeTasks);
router.get('/stats', authMiddleware, TaskController.getTaskStats);
router.post('/', authMiddleware, requireRoles(['admin', 'director']), TaskController.createTask);
router.put('/:id', authMiddleware, TaskController.updateTask);
router.put('/:id/reassign', authMiddleware, TaskController.reassignTask);
router.post('/:id/reassign', authMiddleware, TaskController.reassignTask);
router.put('/:id/transfer', authMiddleware, TaskController.reassignTask);
router.put('/:id/request-extension', authMiddleware, TaskController.requestExtension);
router.put('/:id/review-extension', authMiddleware, TaskController.reviewExtension);
router.put('/:id/resolve', authMiddleware, TaskController.resolveTask);
router.delete('/:id', authMiddleware, TaskController.deleteTask);

module.exports = router;
