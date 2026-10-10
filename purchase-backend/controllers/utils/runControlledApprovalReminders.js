const pool = require('../../config/db');
const { createApprovalReminderService } = require('../../services/approvalReminderService');
const service = createApprovalReminderService();
module.exports = async () => {
  try {
    const capability = await pool.query("SELECT to_regclass('public.approval_reminder_history') IS NOT NULL AS available");
    if (!capability.rows[0]?.available) return;
    const { rows } = await pool.query(`SELECT a.id,a.request_id FROM approvals a JOIN requests r ON r.id=a.request_id
      WHERE a.status='Pending' AND a.is_active=TRUE AND NOT COALESCE(a.is_superseded,FALSE)
      AND COALESCE(a.reminder_sent_at,r.created_at) <= NOW()-INTERVAL '72 hours'`);
    for (const row of rows) {
      try { await service.send({ requestId: row.request_id, approvalId: row.id, source: 'automatic' }); }
      catch (error) { if (![400,409,429].includes(error.statusCode)) console.error('Approval reminder job failed:', error.message); }
    }
  } catch (error) { console.error('Approval reminder job failed:', error.message); }
};
