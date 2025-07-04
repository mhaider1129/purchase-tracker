// controllers/approvalsController.js

const pool = require('../config/db');

const handleApprovalDecision = async (req, res) => {
  const { id } = req.params; // approval ID
  const { status, comments } = req.body;
  const approver_id = req.user.user_id;

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the approval row
    const approvalRes = await client.query(
      `SELECT * FROM approvals WHERE id = $1`,
      [id]
    );

    const approval = approvalRes.rows[0];
    if (!approval) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (approval.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `This approval has already been ${approval.status.toLowerCase()}.`
      });
    }
    if (!approval.is_active) {
      return res.status(403).json({
        error: 'This approval is not yet active for your action.'
      });
}
    if (approval.approver_id !== approver_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not authorized to act on this approval' });
    }

    // 2. Enforce sequential approval (skip check for level 1)
    if (approval.approval_level > 1) {
      const previousApprovals = await client.query(
        `SELECT * FROM approvals 
         WHERE request_id = $1 
           AND approval_level < $2 
           AND status != 'Approved'`,
        [approval.request_id, approval.approval_level]
      );

      if (previousApprovals.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'You cannot approve this request yet. Previous level approvals are still pending.'
        });
      }
    }

    // 3. Update approval status
    await client.query(
      `UPDATE approvals 
       SET status = $1, comments = $2, approved_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [status, comments || null, id]
    );

    // 4. Log the approval decision
    await client.query(
      `INSERT INTO request_logs (request_id, action, actor_id, comments)
       VALUES ($1, $2, $3, $4)`,
      [approval.request_id, `Approval ${status}`, approver_id, comments || null]
    );

    // 5. Insert into audit trail
    await client.query(
      `INSERT INTO approval_logs (approval_id, request_id, approver_id, action, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, approval.request_id, approver_id, status, comments || null]
    );

    // 6. Auto-activate next level
    await client.query(
      `UPDATE approvals 
       SET is_active = TRUE 
       WHERE request_id = $1 
         AND approval_level = $2 
         AND is_active = FALSE`,
      [approval.request_id, approval.approval_level + 1]
    );

    // 7. Check request-level status
    const approvalsRes = await client.query(
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
      await client.query(
        `UPDATE requests 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newStatus, approval.request_id]
      );

      await client.query(
        `INSERT INTO request_logs (request_id, action, actor_id, comments)
         VALUES ($1, $2, $3, $4)`,
        [approval.request_id, `Request marked ${newStatus}`, approver_id, null]
      );
    }

    await client.query('COMMIT');
    res.json({
      message: `Approval ${status.toLowerCase()} successfully`,
      updatedRequestStatus: newStatus || 'Pending'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in handleApprovalDecision:', err);
    res.status(500).json({ error: 'Failed to update approval' });
  } finally {
    client.release();
  }
};

const getApprovalSummary = async (req, res) => {
  const { year, month, department_id, role } = req.query;

  const conditions = [];
  const values = [];

  // Add year filter
  if (year) {
    conditions.push(`EXTRACT(YEAR FROM r.created_at) = $${values.length + 1}`);
    values.push(year);
  }

  // Add month filter
  if (month) {
    conditions.push(`EXTRACT(MONTH FROM r.created_at) = $${values.length + 1}`);
    values.push(month);
  }

  // Filter by department
  if (department_id) {
    conditions.push(`r.department_id = $${values.length + 1}`);
    values.push(department_id);
  }

  // Filter by user role
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
