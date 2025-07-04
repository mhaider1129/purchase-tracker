const express = require('express');
const router = express.Router();
const { deleteFile } = require('../controllers/filesController');
const authMiddleware = require('../middleware/authMiddleware');

// DELETE /files/:id
router.delete('/:id', authMiddleware, deleteFile);

module.exports = router;
