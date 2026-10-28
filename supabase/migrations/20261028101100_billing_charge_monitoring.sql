-- Phase 1 / P1.2 (audit R02): daily billing coverage monitor, database part.
--
-- The billing guard regression of 2026-09-17 .. 2026-10-06 went unnoticed for three weeks
-- because nothing compared worksheets with usage rows. billing_daily_charge_coverage
-- returns, per UTC day, the worksheets that SHOULD be charged against the usage rows that
-- exist, and billing_days_below_charge_threshold returns the days under a ratio (default
-- 0.9) so a scheduled job can alert. Cron and alert wiring are out of scope here
-- (scheduled functions need cronAuth first, audit Phase 5).
--
-- Definitions per day (worksheets.created_at, UTC):
--   created_owned   status created, teacher_id not null
--   excluded        owner is anonymous or has no auth.users row, or created inside a
--                   free promotion window (billing_free_windows)
--   chargeable      created_owned minus excluded
--   charged         chargeable worksheets with a usage row (reference_id = worksheet id)
--   refused         chargeable, uncharged worksheets the trigger recorded as refused
--                   (frozen or no balance: legitimately free, see billing_charge_audit)
--   ratio           charged / (chargeable - refused); NULL when the denominator is 0
--
-- Additive only: one view, one function, service role only. No DROP.

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE VIEW public.billing_daily_charge_coverage AS
WITH owned AS (
  SELECT
    (w.created_at AT TIME ZONE 'UTC')::date AS day,
    w.id,
    (u.id IS NULL OR COALESCE(u.is_anonymous, false)
       OR public.is_free_generation_window(w.created_at)) AS excluded,
    EXISTS (
      SELECT 1 FROM public.token_transactions t
      WHERE t.reference_id = w.id AND t.transaction_type = 'usage'
    ) AS has_usage,
    EXISTS (
      SELECT 1 FROM public.billing_charge_audit a
      WHERE a.worksheet_id = w.id AND a.outcome = 'refused'
        AND a.reason IN ('frozen', 'no_balance')
    ) AS was_refused
  FROM public.worksheets w
  LEFT JOIN auth.users u ON u.id = w.teacher_id
  WHERE w.status = 'created' AND w.teacher_id IS NOT NULL
)
SELECT
  day,
  count(*)::integer AS created_owned,
  count(*) FILTER (WHERE excluded)::integer AS excluded,
  count(*) FILTER (WHERE NOT excluded)::integer AS chargeable,
  count(*) FILTER (WHERE NOT excluded AND has_usage)::integer AS charged,
  count(*) FILTER (WHERE NOT excluded AND NOT has_usage AND was_refused)::integer AS refused,
  CASE
    WHEN count(*) FILTER (WHERE NOT excluded AND NOT (NOT has_usage AND was_refused)) = 0 THEN NULL
    ELSE round(
      count(*) FILTER (WHERE NOT excluded AND has_usage)::numeric
      / count(*) FILTER (WHERE NOT excluded AND NOT (NOT has_usage AND was_refused)),
      4)
  END AS ratio
FROM owned
GROUP BY day;

REVOKE ALL ON TABLE public.billing_daily_charge_coverage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.billing_daily_charge_coverage TO service_role;

CREATE OR REPLACE FUNCTION public.billing_days_below_charge_threshold(
  p_days integer DEFAULT 7,
  p_threshold numeric DEFAULT 0.9
)
 RETURNS TABLE(day date, chargeable integer, charged integer, refused integer, ratio numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT c.day, c.chargeable, c.charged, c.refused, c.ratio
  FROM public.billing_daily_charge_coverage c
  WHERE c.day >= (now() AT TIME ZONE 'UTC')::date - GREATEST(COALESCE(p_days, 7), 1) + 1
    AND c.ratio IS NOT NULL
    AND c.ratio < COALESCE(p_threshold, 0.9)
  ORDER BY c.day DESC;
$function$;

REVOKE ALL ON FUNCTION public.billing_days_below_charge_threshold(integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_days_below_charge_threshold(integer, numeric) TO service_role;
