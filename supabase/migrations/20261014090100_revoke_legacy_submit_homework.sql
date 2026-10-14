-- Revoke the legacy homework submit RPC from client roles (iteration 7).
--
-- submit_homework_answers(uuid, text) authorises nothing: anyone who knows a
-- homework id can mark it completed. The client calls
-- submit_homework_answers_by_share_token since 20261014090000; that wrapper is
-- SECURITY DEFINER and keeps calling this function as its owner.
--
-- APPLY ORDER: after 20261014090000, after 20261012200100 (legacy answer RPCs)
-- and after the client release that calls the token RPC has been live for at
-- least a day (an open tab on an older release still calls the legacy name).
-- Rollback: GRANT EXECUTE ON FUNCTION public.submit_homework_answers(uuid, text) TO anon, authenticated.

SET LOCAL lock_timeout = '5s';

DO $revoke$
BEGIN
  IF to_regprocedure('public.submit_homework_answers_by_share_token(text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261014090000 before revoking submit_homework_answers';
  END IF;
  REVOKE EXECUTE ON FUNCTION public.submit_homework_answers(uuid, text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.submit_homework_answers(uuid, text) TO service_role;
END
$revoke$;
