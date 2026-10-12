-- Revoke the legacy student answer RPCs from client roles (iteration 6).
--
-- save_homework_answer, get_student_homework_answers, save_worksheet_answer and
-- get_worksheet_student_answers authorise with an id and an email only, so
-- anyone who knew both could read or overwrite a student's answers. Since
-- 20261012090100 the client calls the *_by_share_token wrappers (link token +
-- assigned email, owner teacher always passes), which are SECURITY DEFINER and
-- keep calling these functions as their owner, so revoking them from anon and
-- authenticated does not affect the wrappers. Edge Functions use the service
-- role, which keeps EXECUTE.
--
-- APPLY ORDER: after 20261012090100 and after the client release that calls the
-- token RPCs has been live for at least a day (a browser tab opened on an
-- older release still calls the legacy names and would fail to save).
-- Rollback: GRANT EXECUTE ON FUNCTION <each overload> TO anon, authenticated.

SET LOCAL lock_timeout = '5s';

DO $revoke$
DECLARE
  r record;
BEGIN
  IF to_regprocedure('public.save_homework_answer_by_share_token(text, uuid, text, integer, text, jsonb, integer, integer, jsonb, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261012090100 (share-token answer RPCs) before revoking the legacy RPCs';
  END IF;

  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('save_homework_answer', 'get_student_homework_answers',
                        'save_worksheet_answer', 'get_worksheet_student_answers')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
  END LOOP;
END
$revoke$;
