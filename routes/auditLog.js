const express = require('express');
const router = express.Router();
const { getAuditLog } = require('../controllers/auditLogController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, getAuditLog);

module.exports = router;
