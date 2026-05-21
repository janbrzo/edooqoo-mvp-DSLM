CREATE OR REPLACE FUNCTION public.get_active_model_issues()
RETURNS TABLE(provider text, model text, last_seen timestamptz, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(component, 'unknown') AS provider,
    COALESCE(context->>'model', 'unknown') AS model,
    MAX(created_at) AS last_seen,
    COUNT(*)::bigint AS count
  FROM public.error_logs
  WHERE error_code IN ('model_deprecation', 'model_failure')
    AND created_at > now() - interval '24 hours'
  GROUP BY COALESCE(component, 'unknown'), COALESCE(context->>'model', 'unknown')
  ORDER BY last_seen DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_model_issues() TO anon, authenticated;