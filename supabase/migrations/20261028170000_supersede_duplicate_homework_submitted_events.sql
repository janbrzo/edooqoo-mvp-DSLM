-- Legacy duplicates: older versions logged `homework_submitted` several times for one homework
-- (12 homework/student pairs, 34 extra rows on 2026-10-28). The earliest event of each pair stays;
-- the extras are marked superseded (kept for history, never deleted), like every other replaced
-- DSLM evidence. Idempotent: a second run finds nothing to mark.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY source_id, student_id ORDER BY created_at, id) AS rn
  FROM public.student_events
  WHERE event_type = 'homework_submitted' AND superseded_at IS NULL
)
UPDATE public.student_events e
   SET superseded_at = now()
  FROM ranked r
 WHERE e.id = r.id AND r.rn > 1;
