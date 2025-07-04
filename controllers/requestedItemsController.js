// controllers/requestedItemsController.js

const pool = require('../config/db');

// Add multiple items to a request
const addRequestedItems = async (req, res) => {
  const { request_id, items } = req.body;

  if (!request_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid input: request_id and items are required' });
  }

  try {
    const insertedItems = [];

    for (const item of items) {
      const {
        item_name,
        quantity,
        unit_cost,
        available_quantity,
        intended_use,
        specs,
        device_info,
        purchase_type
      } = item;

      const result = await pool.query(
        `INSERT INTO requested_items 
          (request_id, item_name, quantity, unit_cost, available_quantity, intended_use, specs, device_info, purchase_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          request_id,
          item_name,
          quantity,
          unit_cost || null,
          available_quantity || null,
          intended_use || null,
          specs || null,
          device_info || null,
          purchase_type || null
        ]
      );

      insertedItems.push(result.rows[0]);
    }

    res.status(201).json(insertedItems);
  } catch (err) {
  console.error('Error adding requested items:', err.message);
  res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addRequestedItems,
};
