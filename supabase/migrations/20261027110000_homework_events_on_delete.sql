-- Homework P1.4: deleting a homework no longer leaves its DSLM evidence feeding the metrics.
--
-- The events of a deleted homework used to stay (student_events.source_id has no FK), keep their
-- weight in student_skill_metrics and point at a homework that no longer exists. They are now
-- marked superseded_at, the same history pattern as a Welcome Test retake: the rows stay for
-- history, compute_skill_metric ignores them and the update trigger recomputes the metrics.
-- The student's answer rows are removed with the homework (cascade), so nothing else refers to them.
--
-- Not backfilled on purpose: the two orphan events that exist today belong to test data.

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.supersede_homework_events(p_homework_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_marked integer;
BEGIN
  UPDATE public.student_events
     SET superseded_at = now()
   WHERE event_source = 'homework'
     AND source_id = p_homework_id
     AND superseded_at IS NULL;
  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RETURN v_marked;
END;
$function$;

CREATE OR REPLACE FUNCTION public.supersede_homework_events_on_homework_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.supersede_homework_events(OLD.id);
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Cleaning evidence must never block the teacher from deleting a homework.
  RAISE WARNING 'supersede_homework_events_on_homework_delete failed: %', SQLERRM;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.supersede_homework_events(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supersede_homework_events_on_homework_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supersede_homework_events(uuid) TO service_role;

CREATE OR REPLACE TRIGGER trg_supersede_homework_events_on_delete
  AFTER DELETE ON public.homework_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.supersede_homework_events_on_homework_delete();
