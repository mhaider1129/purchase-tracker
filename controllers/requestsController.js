const pool = require('../config/db');

// Create a new request and assign approvers dynamically
const createRequest = async (req, res) => {
  const {
    request_type,
    requester_id,
    department_id,
    justification,
    budget_impact_month,
    items // array of { item_name, quantity, unit_cost, ... }
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert the request
    const requestRes = await client.query(
      `INSERT INTO requests (request_type, requester_id, department_id, justification, budget_impact_month)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request_type, requester_id, department_id, justification, budget_impact_month]
    );
    const request = requestRes.rows[0];

    // 2. Insert requested items
    for (const item of items) {
      await client.query(
        `INSERT INTO requested_items
         (request_id, item_name, quantity, unit_cost, available_quantity, intended_use, specs, device_info, purchase_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          request.id,
          item.item_name,
          item.quantity,
          item.unit_cost || null,
          item.available_quantity || null,
          item.intended_use || null,
          item.specs || null,
          item.device_info || null,
          item.purchase_type || null
        ]
      );
    }

    // 3. Calculate estimated cost
    const costRes = await client.query(
      `SELECT SUM(quantity * unit_cost) AS total FROM requested_items WHERE request_id = $1`,
      [request.id]
    );
    const estimatedCost = parseInt(costRes.rows[0].total || '0', 10);

    await client.query(
      `UPDATE requests SET estimated_cost = $1 WHERE id = $2`,
      [estimatedCost, request.id]
    );

    // 4. Get department type
    const deptRes = await client.query(
      `SELECT type FROM departments WHERE id = $1`,
      [department_id]
    );
    const deptType = deptRes.rows[0].type;

    // 5. Get dynamic approval route
    const routeRes = await client.query(
      `SELECT * FROM approval_routes
       WHERE request_type = $1 AND department_type = $2
         AND $3 BETWEEN min_amount AND max_amount
       ORDER BY approval_level ASC`,
      [request_type, deptType, estimatedCost]
    );
    const routes = routeRes.rows;

    // 6. Assign approvers
    for (const route of routes) {
      const approverRes = await client.query(
        `SELECT id FROM users WHERE role = $1 AND ($2::int IS NULL OR department_id = $2) LIMIT 1`,
        [route.role, route.role === 'HOD' ? department_id : null]
      );
      const approver = approverRes.rows[0];
      if (approver) {
        await client.query(
          `INSERT INTO approvals (request_id, approver_id, approval_level, status, is_active)
           VALUES ($1, $2, $3, 'Pending', $4)`,
          [
            request.id,
            approver.id,
            route.approval_level,
            route.approval_level === 1
          ]
        );
      }
    }

    // 7. Log request creation
    await client.query(
      `INSERT INTO request_logs (request_id, action, actor_id, comments)
       VALUES ($1, $2, $3, $4)`,
      [request.id, 'Created', requester_id, justification]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Request created successfully with approval routing',
      request_id: request.id,
      estimated_cost: estimatedCost
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating request:', err);
    res.status(500).json({ error: 'Failed to create request' });
  } finally {
    client.release();
  }
};

// Get request by ID with items and approvals
const getRequestDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const requestRes = await pool.query(`SELECT * FROM requests WHERE id = $1`, [id]);
    if (requestRes.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const itemsRes = await pool.query(
      `SELECT * FROM requested_items WHERE request_id = $1`,
      [id]
    );

    const approvalsRes = await pool.query(
      `SELECT a.*, u.name AS approver_name, u.role
       FROM approvals a
       JOIN users u ON a.approver_id = u.id
       WHERE a.request_id = $1
       ORDER BY a.approval_level ASC`,
      [id]
    );

    res.json({
      request: requestRes.rows[0],
      items: itemsRes.rows,
      approvals: approvalsRes.rows
    });
  } catch (err) {
    console.error('Error getting request details:', err);
    res.status(500).json({ error: 'Failed to get request details' });
  }
};

// Get all requests with filters and pagination
const getAllRequests = async (req, res) => {
  const {
    status, department, request_type, budget_impact_month,
    start_date, end_date, limit, offset
  } = req.query;

  const { user_id, role, department_id } = req.user;

  try {
    let query = `
      SELECT 
        r.id, r.request_type, r.status, r.justification, r.created_at, 
        r.budget_impact_month, d.name AS department, u.name AS requester
      FROM requests r
      JOIN departments d ON r.department_id = d.id
      JOIN users u ON r.requester_id = u.id
    `;

    const conditions = [];
    const values = [];

    // Role-based access
    if (role === 'requester') {
      conditions.push(`r.requester_id = $${values.length + 1}`);
      values.push(user_id);
    } else if (role === 'HOD') {
      conditions.push(`r.department_id = $${values.length + 1}`);
      values.push(department_id);
    }

    // Filters
    if (status) {
      conditions.push(`r.status = $${values.length + 1}`);
      values.push(status);
    }
    if (department) {
      conditions.push(`d.name ILIKE $${values.length + 1}`);
      values.push(`%${department}%`);
    }
    if (request_type) {
      conditions.push(`r.request_type = $${values.length + 1}`);
      values.push(request_type);
    }
    if (budget_impact_month) {
      conditions.push(`r.budget_impact_month = $${values.length + 1}`);
      values.push(budget_impact_month);
    }
    if (start_date) {
      conditions.push(`r.created_at >= $${values.length + 1}`);
      values.push(start_date);
    }
    if (end_date) {
      conditions.push(`r.created_at <= $${values.length + 1}`);
      values.push(end_date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY r.created_at DESC';

    if (limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(limit);
    }
    if (offset) {
      query += ` OFFSET $${values.length + 1}`;
      values.push(offset);
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching requests:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

// Get pending approvals for logged-in user
const getPendingApprovals = async (req, res) => {
  const { user_id } = req.user;

  try {
    const result = await pool.query(
      `SELECT 
         r.id, r.request_type, r.status, r.justification, r.created_at,
         d.name AS department, u.name AS requester,
         a.approval_level, a.status AS approval_status
       FROM approvals a
       JOIN requests r ON a.request_id = r.id
       JOIN users u ON r.requester_id = u.id
       JOIN departments d ON r.department_id = d.id
       WHERE a.approver_id = $1 AND a.status = 'Pending' AND a.is_active = TRUE
       ORDER BY r.created_at DESC`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending approvals:', err);
    res.status(500).json({ error: 'Failed to get pending approvals' });
  }
};

// Get request logs
const getRequestLogs = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT rl.*, u.name AS actor_name
       FROM request_logs rl
       JOIN users u ON rl.actor_id = u.id
       WHERE rl.request_id = $1
       ORDER BY rl.timestamp ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

module.exports = {
  createRequest,
  getRequestDetails,
  getAllRequests,
  getPendingApprovals,
  getRequestLogs
};
