-- MANUAL DATABASE MIGRATION REQUIRED. Apply after SQL 046.
BEGIN;
ALTER TABLE public.maintenance_approval_reporting_policy ADD COLUMN IF NOT EXISTS reminder_cooldown_hours INTEGER NOT NULL DEFAULT 24 CHECK (reminder_cooldown_hours BETWEEN 1 AND 168);
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.approval_reminder_history (
  id BIGSERIAL PRIMARY KEY,
  approval_id INTEGER NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  request_id INTEGER NOT NULL REFERENCES public.requests(id),
  recipient_user_id INTEGER NOT NULL REFERENCES public.users(id),
  actor_user_id INTEGER REFERENCES public.users(id),
  source TEXT NOT NULL CHECK (source IN ('manual','automatic')),
  status TEXT NOT NULL CHECK (status IN ('sending','sent','failed','unknown','cancelled')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS approval_reminder_history_approval_time ON public.approval_reminder_history(approval_id, attempted_at DESC);
ALTER TABLE public.approval_reminder_history ENABLE ROW LEVEL SECURITY;
INSERT INTO public.permissions (code,name,description) VALUES ('approvals.remind','Send approval reminders','Send manual reminders to active approvers and view reminder history') ON CONFLICT(code) DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id) SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p WHERE lower(trim(r.name))='scm' AND p.code='approvals.remind' ON CONFLICT DO NOTHING;
COMMIT;
SELECT reminder_cooldown_hours FROM public.maintenance_approval_reporting_policy WHERE id=1;
