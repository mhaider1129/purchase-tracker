// controllers/approvalsController.js

const pool = require('../config/db');

const handleApprovalDecision = async (req, res) => {
  const { id } = req.params; // approval ID
  const { status, comments } = req.body;
  const approver_id = req.user.user_id;

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    // 1. Get the approval row
    const approvalRes = await pool.query(
      `SELECT * FROM approvals WHERE id = $1`,
      [id]
    );

    const approval = approvalRes.rows[0];
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (approval.status !== 'Pending') {
      return res.status(403).json({
        error: `This approval has already been ${approval.status.toLowerCase()}.`
      });
    }

    if (approval.approver_id !== approver_id) {
      return res.status(403).json({ error: 'You are not authorized to act on this approval' });
    }

    // 2. Update approval status
    await pool.query(
      `UPDATE approvals SET status = $1, comments = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [status, comments || null, id]
    );
// Log the approval decision
    await pool.query(
     `INSERT INTO request_logs (request_id, action, actor_id, comments)
      VALUES ($1, $2, $3, $4)`,
      [approval.request_id, `Approval ${status}`, approver_id, comments || null]
    );
    // 3. Insert into audit trail
    await pool.query(
      `INSERT INTO approval_logs (approval_id, request_id, approver_id, action, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, approval.request_id, approver_id, status, comments || null]
    );

    // 4. Check all approvals
    const approvalsRes = await pool.query(
      `SELECT status FROM approvals WHERE request_id = $1`,
      [approval.request_id]
    );

    const statuses = approvalsRes.rows.map(a => a.status);
    let newStatus = null;

    if (statuses.includes('Rejected')) {
      newStatus = 'Rejected';
    } else if (statuses.every(s => s === 'Approved')) {
      newStatus = 'Approved';
    }

    if (newStatus) {
      await pool.query(
        `UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newStatus, approval.request_id]
      );
    }

    // Log status update
    await pool.query(
      `INSERT INTO request_logs (request_id, action, actor_id, comments)
       VALUES ($1, $2, $3, $4)`,
      [approval.request_id, `Request marked ${newStatus}`, approver_id, null]
    );

    res.json({
      message: `Approval ${status.toLowerCase()} successfully`,
      updatedRequestStatus: newStatus || 'Pending'
    });

  } catch (err) {
    console.error('Error in handleApprovalDecision:', err.message);
    res.status(500).json({ error: 'Failed to update approval' });
  }
}
const getApprovalSummary = async (req, res) => {
  const { month, department_id, role } = req.query;

  const conditions = [];
  const values = [];

  if (month) {
    conditions.push(`r.budget_impact_month = $${values.length + 1}`);
    values.push(month);
  }

  if (department_id) {
    conditions.push(`r.department_id = $${values.length + 1}`);
    values.push(department_id);
  }

  if (role) {
    conditions.push(`u.role = $${values.length + 1}`);
    values.push(role);
  }

  let query = `
    SELECT
      COUNT(*) AS total_requests,
      COUNT(*) FILTER (WHERE r.status = 'Approved') AS approved,
      COUNT(*) FILTER (WHERE r.status = 'Rejected') AS rejected,
      COUNT(*) FILTER (WHERE r.status = 'Submitted') AS pending
    FROM requests r
    JOIN users u ON r.requester_id = u.id
  `;

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  try {
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting approval summary:', err.message);
    res.status(500).json({ error: 'Failed to get summary' });
  }
};


module.exports = {
  handleApprovalDecision,
  getApprovalSummary,
};
