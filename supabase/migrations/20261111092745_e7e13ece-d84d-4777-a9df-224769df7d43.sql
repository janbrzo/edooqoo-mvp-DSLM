CREATE TABLE public.public_placement_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_token text NOT NULL UNIQUE,
  student_name text NOT NULL,
  student_email text,
  teacher_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  completed_report_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.public_placement_invites TO service_role;
ALTER TABLE public.public_placement_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX public_placement_invites_teacher_email_created_idx ON public.public_placement_invites (teacher_email, created_at DESC);
ALTER TABLE public.public_placement_reports ADD COLUMN invite_id uuid;