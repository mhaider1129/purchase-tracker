const pool = require('../config/db');

const getAuditLog = async (req, res) => {
  const { request_id, approver_id, action, from_date, to_date } = req.query;

  const filters = [];
  const values = [];

  if (request_id) {
    filters.push(`l.request_id = $${values.length + 1}`);
    values.push(request_id);
  }

  if (approver_id) {
    filters.push(`l.approver_id = $${values.length + 1}`);
    values.push(approver_id);
  }

  if (action) {
    filters.push(`l.action = $${values.length + 1}`);
    values.push(action);
  }

  if (from_date) {
    filters.push(`l.created_at >= $${values.length + 1}`);
    values.push(from_date);
  }

  if (to_date) {
    filters.push(`l.created_at <= $${values.length + 1}`);
    values.push(to_date);
  }

  let query = `
    SELECT 
      l.*, 
      u.name AS approver_name, 
      r.justification 
    FROM approval_logs l
    JOIN users u ON l.approver_id = u.id
    JOIN requests r ON l.request_id = r.id
  `;

  if (filters.length > 0) {
    query += ' WHERE ' + filters.join(' AND ');
  }

  query += ' ORDER BY l.created_at DESC';

  try {
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
};

module.exports = { getAuditLog };
