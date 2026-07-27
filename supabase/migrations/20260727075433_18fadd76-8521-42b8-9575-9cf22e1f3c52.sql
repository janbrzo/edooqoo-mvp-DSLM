-- Fix Supabase linter warning: public views must use invoker permissions.
ALTER VIEW IF EXISTS public.conversion_funnel SET (security_invoker = true);
ALTER VIEW IF EXISTS public.popular_form_params SET (security_invoker = true);
ALTER VIEW IF EXISTS public.student_category_metrics SET (security_invoker = true);
ALTER VIEW IF EXISTS public.student_micro_skill_metrics SET (security_invoker = true);

-- Calendar hardening: public users may see only genuinely available slots.
-- Booked/pending lessons can contain student names, notes, worksheet links, or meeting links.
DROP POLICY IF EXISTS "Students can view their booked slots" ON public.calendar_slots;
DROP POLICY IF EXISTS "Public can view pending slots" ON public.calendar_slots;

-- Download session hardening: no direct browser table reads/updates/inserts.
DROP POLICY IF EXISTS "Anonymous can read download sessions by token" ON public.download_sessions;
DROP POLICY IF EXISTS "Users can view their own download sessions" ON public.download_sessions;
DROP POLICY IF EXISTS "Allow insert for edge functions" ON public.download_sessions;
DROP POLICY IF EXISTS "Allow update for edge functions" ON public.download_sessions;
DROP POLICY IF EXISTS "users_view_own_download_sessions" ON public.download_sessions;
DROP POLICY IF EXISTS "service_role_manage_download_sessions" ON public.download_sessions;
DROP POLICY IF EXISTS "Service role full access download_sessions" ON public.download_sessions;

REVOKE ALL ON public.download_sessions FROM anon;
REVOKE ALL ON public.download_sessions FROM authenticated;
GRANT ALL ON public.download_sessions TO service_role;

CREATE POLICY "Service role full access download_sessions"
ON public.download_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_download_session_by_token(p_session_token text)
RETURNS TABLE (
  id uuid,
  session_token text,
  downloads_count integer,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  worksheet_id uuid,
  payment_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ds.id,
    ds.session_token,
    COALESCE(ds.downloads_count, 0) AS downloads_count,
    ds.expires_at,
    ds.created_at,
    ds.worksheet_id,
    ds.payment_id
  FROM public.download_sessions ds
  WHERE ds.session_token = p_session_token
    AND ds.expires_at > now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.increment_download_session_by_token(p_session_token text)
RETURNS TABLE (
  downloads_count integer,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.download_sessions ds
  SET downloads_count = COALESCE(ds.downloads_count, 0) + 1
  WHERE ds.session_token = p_session_token
    AND ds.expires_at > now()
  RETURNING COALESCE(ds.downloads_count, 0), ds.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_download_session_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_download_session_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_download_session_by_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_download_session_by_token(text) TO anon, authenticated, service_role;