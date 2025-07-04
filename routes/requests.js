// routes/requests.js

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware'); // ✅ declare BEFORE use

const {
  createRequest,
  getRequestDetails,
  getAllRequests,
  getPendingApprovals,
  getRequestLogs // ✅ make sure this is imported
} = require('../controllers/requestsController');

// Routes
router.post('/', createRequest);
router.get('/', getAllRequests);
router.get('/pending-approvals', getPendingApprovals);
router.get('/:id', getRequestDetails);
router.get('/:id/logs', authMiddleware, getRequestLogs); // ✅ this line should now work

module.exports = router;
