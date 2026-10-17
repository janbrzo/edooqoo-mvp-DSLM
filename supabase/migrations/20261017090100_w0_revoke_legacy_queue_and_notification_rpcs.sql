-- W0 follow-up: revoke the anon-callable queue and notification RPCs.
--
-- queue_worksheet_ai_evaluation / needs_ai_evaluation took only ids and an email:
-- anyone with a worksheet id could reset queue rows and burn LLM cost, and the
-- queued context (answer key, skill names) was client supplied.
-- insert_homework_submission_notification let anyone with a homework id write
-- a notification (with a caller-chosen message) to the teacher.
-- The client calls the *_by_share_token variants since 20261016100020; those
-- are SECURITY DEFINER and keep calling these functions as their owner. The
-- Edge Functions use the service role.
--
-- APPLY ORDER: after 20261016100020 and after the client release that calls
-- the token variants has been live for at least a day (an open tab on an older
-- release still calls the legacy names).
-- Rollback: GRANT EXECUTE ON FUNCTION <name> TO anon, authenticated.

SET LOCAL lock_timeout = '5s';

DO $revoke$
BEGIN
  IF to_regprocedure('public.queue_worksheet_ai_evaluation_by_share_token(text, uuid, text, integer, text, jsonb, text, jsonb)') IS NULL
     OR to_regprocedure('public.insert_homework_submission_notification_by_share_token(text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261016100020 before revoking the legacy queue and notification RPCs';
  END IF;

  REVOKE EXECUTE ON FUNCTION public.queue_worksheet_ai_evaluation(uuid, text, integer, text, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.needs_ai_evaluation(uuid, text, integer) FROM PUBLIC, anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.insert_homework_submission_notification(uuid, text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.queue_worksheet_ai_evaluation(uuid, text, integer, text, jsonb, text, jsonb) TO service_role;
  GRANT EXECUTE ON FUNCTION public.needs_ai_evaluation(uuid, text, integer) TO service_role;
  GRANT EXECUTE ON FUNCTION public.insert_homework_submission_notification(uuid, text) TO service_role;
END
$revoke$;
