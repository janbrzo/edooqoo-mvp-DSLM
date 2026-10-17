-- Timestamp defaults: 26 timestamptz columns defaulted to
-- (now() AT TIME ZONE 'Europe/Warsaw'), set in the dashboard and never in a
-- migration. That expression is a wall-clock timestamp without time zone, read
-- back as UTC, so new rows were stamped 1 hour (winter) or 2 hours (summer) in
-- the future (confirmed 2026-10-17: student_tests.created_at was 2 h after the
-- share token created in the same request). It stretched every created_at
-- window (anonymous worksheet RLS 6 h, Stripe webhook dedupe windows, feedback
-- edit window), showed "in 1 hour" labels and floated fresh rows above newer
-- events in timelines. Nothing in the code compensates for the offset.
--
-- Forward only: historical rows are left as they are, because some rows were
-- written with an explicit, correct created_at and cannot be told apart.

SET LOCAL lock_timeout = '10s';

ALTER TABLE public.feedbacks ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.future_worksheet_suggestions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.future_worksheet_suggestions ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.homework_notifications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.student_knowledge_entries ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.student_knowledge_entries ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.student_learning_elements ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.student_learning_elements ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.student_progress_goals ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.student_progress_goals ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.student_test_questions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.student_tests ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.student_tests ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.students ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.students ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.subscription_events ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.subscriptions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.subscriptions ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.test_skill_results ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.token_transactions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.user_events ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.user_roles ALTER COLUMN assigned_at SET DEFAULT now();
ALTER TABLE public.worksheets ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.worksheets ALTER COLUMN last_modified_at SET DEFAULT now();
