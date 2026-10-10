const createHttpError = require('../utils/httpError');
const { writeAuditEvent } = require('./auditService');

async function loadPolicy(client, { lock = false } = {}) {
  const capability = await client.query("SELECT to_regclass('public.maintenance_approval_reporting_policy') IS NOT NULL AS available");
  if (capability.rows[0]?.available !== true) return { configured: false, overdue_target_days: null };
  const result = await client.query(`SELECT overdue_target_days, reason, updated_by, updated_at, (to_jsonb(p)->>'reminder_cooldown_hours')::integer AS reminder_cooldown_hours FROM public.maintenance_approval_reporting_policy p WHERE id = 1 ${lock ? 'FOR UPDATE' : ''}`);
  return { ...result.rows[0], configured: Boolean(result.rows[0]), overdue_target_days: result.rows[0]?.overdue_target_days ?? null };
}

async function updatePolicy(client, input, actor) {
  const days = input.overdue_target_days;
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) throw createHttpError(400, 'Target must be null or a whole number from 1 to 365 days');
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 2000) throw createHttpError(400, 'A change reason from 1 to 2000 characters is required');
  const previous = await loadPolicy(client, { lock: true });
  if (!previous.configured) throw createHttpError(503, 'Apply 046_maintenance_approval_reporting_policy.sql first');
  const cooldown = input.reminder_cooldown_hours;
  if (cooldown !== undefined && (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 168)) throw createHttpError(400, 'Cooldown must be a whole number from 1 to 168 hours');
  if (cooldown !== undefined && previous.reminder_cooldown_hours == null) throw createHttpError(503, 'Apply 047_manual_approval_reminders.sql first');
  const result = cooldown === undefined
    ? await client.query(`UPDATE public.maintenance_approval_reporting_policy SET overdue_target_days = $1, reason = $2, updated_by = $3, updated_at = NOW() WHERE id = 1 RETURNING overdue_target_days, reason, updated_by, updated_at`, [days, input.reason.trim(), actor.id])
    : await client.query(`UPDATE public.maintenance_approval_reporting_policy SET overdue_target_days=$1,reminder_cooldown_hours=$2,reason=$3,updated_by=$4,updated_at=NOW() WHERE id=1 RETURNING overdue_target_days,reminder_cooldown_hours,reason,updated_by,updated_at`, [days, cooldown, input.reason.trim(), actor.id]);
  const next = result.rows[0];
  await writeAuditEvent({ client, entityType: 'maintenance_approval_reporting_policy', entityId: 1, action: 'maintenance_approval_reporting_policy.updated', actorUserId: actor.id, reason: input.reason.trim(), beforeData: previous, afterData: next });
  return { ...next, configured: true };
}
module.exports = { loadPolicy, updatePolicy };
