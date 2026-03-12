const express = require('express');
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorize');

const router = express.Router();

// Employee creation is restricted (admin only). End-users should not self-register.
router.post('/register', authMiddleware, requireRoles(['admin']), AuthController.register);
router.post('/request-register', AuthController.requestRegister);
router.post('/login', AuthController.login);

module.exports = router;
