// routes/approvals.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  handleApprovalDecision,
  getApprovalSummary
} = require('../controllers/approvalsController');

router.patch('/:id/decision', authMiddleware, handleApprovalDecision);
router.get('/summary', authMiddleware, getApprovalSummary);

module.exports = router;
// This file defines the routes for handling approval decisions and summaries.
// It uses the authMiddleware to ensure that only authenticated users can access these routes.