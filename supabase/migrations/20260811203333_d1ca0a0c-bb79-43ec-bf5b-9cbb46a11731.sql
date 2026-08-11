-- Restrict permissive service-role policies to the service_role role only.
DROP POLICY IF EXISTS "Service role can manage all notifications" ON public.homework_notifications;
CREATE POLICY "Service role can manage all notifications"
  ON public.homework_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to learning profiles" ON public.student_learning_profiles;
CREATE POLICY "Service role full access to learning profiles"
  ON public.student_learning_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.homework_notifications FROM anon;
REVOKE ALL ON public.student_learning_profiles FROM anon;