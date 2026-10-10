# Manual approval reminders

Apply `sql/manual/047_manual_approval_reminders.sql` manually after SQL 046, then
deploy backend and frontend. The patch creates a durable attempt history, adds
the cooldown setting (24 hours by default, 1–168 configurable), ensures the
existing reminder timestamp, and seeds `approvals.remind` for existing SCM roles.
Existing settings, approvals and logs are preserved. Users should sign in again
after applying permission changes. Other roles require an explicit permission grant.

Management → Approval reporting saves the cooldown with a required reason and
canonical audit. Manual send/history endpoints require `approvals.remind` before
any database access. This is a request-wide capability, so grant it only to staff
who should follow up approvals across requests. Existing viewer scopes still
control which requests appear in the maintenance dashboard.

The Maintenance Request Status queue offers a recipient selector for parallel
active approvals, a confirmation before sending, and reminder history. All
Requests uses the same controls; without an explicit approval ID the endpoint
targets the first actionable active approval, preserving the previous call format.
History includes sender, recipient, time, source and outcome (latest 100 attempts).

Only current active Pending/On Hold, nonsuperseded approvals with an email holder
can receive a reminder. Terminal requests are excluded. The approval is locked
to serialize reservations; an attempt and audit are committed before SMTP. The
sender rechecks/locks ownership through delivery. Recent attempts, legacy
reminder_sent_at timestamps and any sending/unknown attempt block duplicate sends.
Reminder writes do not change approval activation times or business decisions.

Email success means SMTP acceptance, not confirmed inbox delivery. Dry-run,
unconfigured transport and empty acceptance are failures. A thrown SMTP error or
failure after acceptance is recorded as unknown; sending/unknown attempts remain
blocked until reviewed. Reminders disable the email helper's internal SMTP retry
because a timeout can occur after the provider accepted a message. Other emails
keep their existing retry behavior. If recording the outcome itself fails, the original
durable sending reservation remains, preventing an unsafe automatic retry.
Review such cases using SMTP/provider evidence and database audit history.
This release does not include a reconciliation UI for uncertain delivery.

The already-existing daily approval reminder job keeps its 72-hour eligibility
and schedule but shares the same send service, cooldown and history; it does not
send around manual controls. Before SQL 047 is applied, that job skips approval
email sends. Deploy the migration before restarting production to avoid this gap.
No new automatic reminder schedule or escalation rule is enabled.

Validation uses mocked SMTP only. Unit tests cover permissions, validation,
missing migration/holder, cooldown, changed approvals, dry-run/rejection,
ambiguous delivery and post-send audit failure. Disposable PostgreSQL checks
execute real reservation/history queries and concurrent manual/automatic attempts
with two loopback connections, asserting exactly one mocked delivery. No email
or Supabase mutation is performed by these tests.
