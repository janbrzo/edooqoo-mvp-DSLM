CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_public_teacher_contact(p_teacher_id uuid)
RETURNS TABLE(first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.first_name, p.last_name, p.email
  FROM public.profiles p
  WHERE p.id = p_teacher_id
    AND p.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.calendar_settings cs
      WHERE cs.teacher_id = p_teacher_id
        AND cs.public_calendar_token IS NOT NULL
    );
$$;

REVOKE ALL ON FUNCTION public.get_public_teacher_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_contact(uuid) TO anon, authenticated, service_role;