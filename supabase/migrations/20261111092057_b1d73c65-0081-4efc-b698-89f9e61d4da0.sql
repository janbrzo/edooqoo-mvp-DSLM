CREATE TABLE public.public_placement_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_token text NOT NULL UNIQUE,
  result jsonb NOT NULL,
  student_name text NOT NULL,
  student_email text,
  teacher_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_by uuid,
  claimed_student_id uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.public_placement_reports TO service_role;
ALTER TABLE public.public_placement_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX public_placement_reports_teacher_email_created_idx ON public.public_placement_reports (teacher_email, created_at DESC);