CREATE OR REPLACE FUNCTION public.dslm_effective_mastery(p_mastery numeric, p_last_event_at timestamptz, p_now timestamptz)
RETURNS numeric LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public
AS $function$
  SELECT CASE
    WHEN p_mastery IS NULL OR p_mastery::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric
    WHEN p_last_event_at IS NULL THEN p_mastery
    ELSE greatest(0::numeric, least(p_mastery, round(p_mastery *
      CASE WHEN extract(epoch FROM (p_now - p_last_event_at)) <= 14 * 86400 THEN 1::numeric
      ELSE 0.5 + 0.5 * power(0.5::numeric,
        (extract(epoch FROM (p_now - p_last_event_at)) / 86400.0 - 14) / 60) END, 1)))
  END;
$function$;
REVOKE ALL ON FUNCTION public.dslm_effective_mastery(numeric, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dslm_effective_mastery(numeric, timestamptz, timestamptz) TO authenticated, service_role;