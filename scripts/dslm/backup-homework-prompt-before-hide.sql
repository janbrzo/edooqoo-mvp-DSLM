-- Operator step: run BEFORE supabase/migrations/20261029090000_homework_assignments_hide_prompt.sql.
-- Copies id + prompt of the rows that migration blanks (engine system messages) into a
-- service-only table (RLS enabled, no policies: anon/authenticated cannot read it).
-- Idempotent: ON CONFLICT keeps the first backup. Check: select count(*) = 26 after running.

CREATE TABLE IF NOT EXISTS public.homework_prompt_backup_20261029 (
  id uuid PRIMARY KEY,
  prompt text NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homework_prompt_backup_20261029 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.homework_prompt_backup_20261029 FROM anon, authenticated;

INSERT INTO public.homework_prompt_backup_20261029 (id, prompt)
SELECT id, prompt
FROM public.homework_assignments
WHERE prompt IS NOT NULL
  AND length(prompt) > 2000
  AND prompt ~ 'RETURN ONLY VALID JSON'
ON CONFLICT (id) DO NOTHING;
