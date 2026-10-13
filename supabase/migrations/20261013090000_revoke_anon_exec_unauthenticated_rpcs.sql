-- Remove EXECUTE from anon/authenticated on SECURITY DEFINER RPCs that do not
-- check the caller's identity. Owner (postgres) and service_role keep access.
-- Postgres grants EXECUTE to PUBLIC by default, so PUBLIC must be revoked too.
--
-- Not touched on purpose:
--   has_role(): used by RLS policies evaluated as anon/authenticated; revoking
--   it could break policy evaluation.
--   get_student_meeting_link, mark_homework_completed,
--   get_student_homework_answers: called from public/student pages; they need
--   a token/email-verifying rewrite before EXECUTE can be removed.

REVOKE EXECUTE ON FUNCTION public.reactivate_user_account(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_user_account(text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.insert_worksheet_bypass_limit(text, jsonb, text, text, uuid, text, text, text, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_worksheet_bypass_limit(text, jsonb, text, text, uuid, text, text, text, integer, text, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.insert_worksheet_bypass_limit(text, jsonb, text, text, uuid, text, text, text, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_worksheet_bypass_limit(text, jsonb, text, text, uuid, text, text, text, integer, text, text, text)
  TO service_role;
