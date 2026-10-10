const pool = require('../config/db');
const { sendEmail } = require('../utils/emailService');
const httpError = require('../utils/httpError');
const { userHasPermission } = require('../utils/permissionService');
const { writeAuditEvent } = require('./auditService');

const validId = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
const authorize = (actor) => {
  if (!actor?.id || !userHasPermission(actor, 'approvals.remind')) throw httpError(403, 'Permission required: approvals.remind');
};
async function capability(client) {
  const { rows } = await client.query("SELECT to_regclass('public.approval_reminder_history') IS NOT NULL AS available");
  if (!rows[0]?.available) throw httpError(503, 'Apply 047_manual_approval_reminders.sql first');
}

function createApprovalReminderService(database = pool, deliver = sendEmail) {
  async function send({ requestId, approvalId, actor, source = 'manual' }) {
    if (source !== 'automatic') authorize(actor);
    if (!['manual', 'automatic'].includes(source)) throw httpError(400, 'Invalid reminder source');
    if (!validId(requestId) || (approvalId != null && !validId(approvalId))) throw httpError(400, 'Invalid request or approval ID');
    let client;
    let reservation;
    let approval;
    let deliveryStarted = false;
    let accepted = false;
    let rejected = false;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      await capability(client);
      const selected = await client.query(`SELECT a.id AS approval_id,a.request_id,a.approver_id,a.approval_level,a.reminder_sent_at,u.name,u.email,r.request_type
        FROM approvals a JOIN requests r ON r.id=a.request_id LEFT JOIN users u ON u.id=a.approver_id
        WHERE a.request_id=$1 AND ($2::integer IS NULL OR a.id=$2) AND a.is_active=TRUE AND a.status IN ('Pending','On Hold') AND NOT COALESCE(a.is_superseded,FALSE)
        AND lower(trim(r.status)) NOT IN ('approved','completed','received','rejected','cancelled','closed','available in stock','partially procured','procured')
        ORDER BY a.approval_level,a.id LIMIT 1 FOR UPDATE OF a`, [requestId, approvalId ?? null]);
      approval = selected.rows[0];
      if (!approval) throw httpError(409, 'No current actionable approval found');
      if (!approval.approver_id || !approval.email) throw httpError(400, 'Current approver has no email address');
      const policy = await client.query('SELECT reminder_cooldown_hours FROM public.maintenance_approval_reporting_policy WHERE id=1');
      const hours = policy.rows[0]?.reminder_cooldown_hours;
      if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw httpError(503, 'Reminder cooldown is not configured');
      const blocked = await client.query(`SELECT EXISTS(SELECT 1 FROM public.approval_reminder_history WHERE approval_id=$1
        AND (status IN ('sending','unknown') OR attempted_at > NOW()-($2::integer * INTERVAL '1 hour')))
        OR ($3::timestamptz IS NOT NULL AND $3::timestamptz > NOW()-($2::integer * INTERVAL '1 hour')) AS blocked`, [approval.approval_id, hours, approval.reminder_sent_at]);
      if (blocked.rows[0]?.blocked) throw httpError(429, 'Reminder already attempted within cooldown, or delivery needs review');
      reservation = (await client.query(`INSERT INTO public.approval_reminder_history(approval_id,request_id,recipient_user_id,actor_user_id,source,status)
        VALUES($1,$2,$3,$4,$5,'sending') RETURNING id`, [approval.approval_id, requestId, approval.approver_id, actor?.id ?? null, source])).rows[0];
      await writeAuditEvent({ client, entityType: 'approval_reminder', entityId: reservation.id, action: 'approval_reminder.reserved', actorUserId: actor?.id, requestId, metadata: { approval_id: approval.approval_id, recipient_user_id: approval.approver_id, source } });
      await client.query('COMMIT');

      // Keep a durable attempt before SMTP. Recheck and lock ownership through delivery.
      await client.query('BEGIN');
      const current = await client.query(`SELECT a.id FROM approvals a JOIN requests r ON r.id=a.request_id WHERE a.id=$1 AND a.approver_id=$2 AND a.is_active=TRUE
        AND a.status IN ('Pending','On Hold') AND NOT COALESCE(a.is_superseded,FALSE)
        AND lower(trim(r.status)) NOT IN ('approved','completed','received','rejected','cancelled','closed','available in stock','partially procured','procured') FOR UPDATE OF a`, [approval.approval_id, approval.approver_id]);
      if (!current.rows.length) {
        await client.query("UPDATE public.approval_reminder_history SET status='cancelled',completed_at=NOW(),detail='Approval changed before delivery' WHERE id=$1", [reservation.id]);
        await client.query('COMMIT');
        throw httpError(409, 'Approval changed before reminder delivery');
      }
      deliveryStarted = true;
      const result = await deliver(approval.email, `Reminder: request ${requestId} is waiting for your approval`,
        `Hello ${approval.name || 'Approver'},\n\n${actor?.name || 'The approval reminder service'} asks you to review ${approval.request_type} request ${requestId}, approval level ${approval.approval_level}. Please log in to review the request.`, { throwOnError: true, retry: false });
      accepted = Boolean(result && !result.dryRun && (!Array.isArray(result.accepted) || result.accepted.length > 0));
      rejected = !accepted;
      if (rejected) throw httpError(503, 'Reminder email was not accepted; email delivery may be unconfigured or in dry-run mode');
      await client.query("UPDATE public.approval_reminder_history SET status='sent',completed_at=NOW() WHERE id=$1", [reservation.id]);
      await client.query('UPDATE approvals SET reminder_sent_at=NOW() WHERE id=$1', [approval.approval_id]);
      await client.query("INSERT INTO request_logs(request_id,action,actor_id,comments) VALUES($1,'Approval reminder emailed',$2,$3)", [requestId, actor?.id ?? null, `Approval ${approval.approval_id}; recipient user ${approval.approver_id}`]);
      await client.query("INSERT INTO approval_logs(approval_id,request_id,approver_id,action,comments) VALUES($1,$2,$3,'Reminder Sent',$4)", [approval.approval_id, requestId, actor?.id ?? null, `Recipient user ${approval.approver_id}`]);
      await writeAuditEvent({ client, entityType: 'approval_reminder', entityId: reservation.id, action: 'approval_reminder.sent', actorUserId: actor?.id, requestId, metadata: { recipient_user_id: approval.approver_id, source } });
      await client.query('COMMIT');
      return { message: 'Approval reminder email accepted for delivery', request_id: Number(requestId), approval_id: approval.approval_id, approver_id: approval.approver_id, approval_level: approval.approval_level, reminder_id: reservation.id };
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      if (reservation && deliveryStarted) {
        // A thrown SMTP error or post-send DB failure is ambiguous: never blindly retry.
        const status = rejected ? 'failed' : 'unknown';
        await client.query('UPDATE public.approval_reminder_history SET status=$1,completed_at=NOW(),detail=$2 WHERE id=$3', [status, status === 'unknown' ? 'Delivery outcome needs review; do not resend' : 'Email was not accepted', reservation.id]);
      }
      throw error;
    } finally { client?.release(); }
  }
  async function history(requestId, actor) {
    authorize(actor);
    if (!validId(requestId)) throw httpError(400, 'Invalid request ID');
    await capability(database);
    return (await database.query(`SELECT h.id,h.approval_id,h.recipient_user_id,u.name AS recipient_name,actor.name AS actor_name,h.actor_user_id,h.source,h.status,h.attempted_at,h.completed_at,h.detail
      FROM public.approval_reminder_history h LEFT JOIN users u ON u.id=h.recipient_user_id LEFT JOIN users actor ON actor.id=h.actor_user_id
      WHERE h.request_id=$1 ORDER BY h.attempted_at DESC,h.id DESC LIMIT 100`, [requestId])).rows;
  }
  return { send, history };
}
module.exports = { createApprovalReminderService };
