// routes/requestedItems.js

const express = require('express');
const router = express.Router();
const { addRequestedItems } = require('../controllers/requestedItemsController');

// POST /requested-items
router.post('/', addRequestedItems);

module.exports = router;
