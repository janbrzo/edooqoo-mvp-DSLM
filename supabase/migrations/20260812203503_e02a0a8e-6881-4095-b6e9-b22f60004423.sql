ALTER POLICY "Service role full access student_events" ON public.student_events TO service_role;
ALTER POLICY "Service role full access student_skill_metrics" ON public.student_skill_metrics TO service_role;
REVOKE ALL ON public.student_events FROM anon;
REVOKE ALL ON public.student_skill_metrics FROM anon;
GRANT ALL ON public.student_events TO service_role;
GRANT ALL ON public.student_skill_metrics TO service_role;