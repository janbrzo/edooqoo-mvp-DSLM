
-- === worksheets ===
DROP POLICY IF EXISTS "Worksheets access policy" ON public.worksheets;

CREATE POLICY "Teachers manage own worksheets"
ON public.worksheets FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Anonymous (unclaimed) worksheets from the public generator stay reachable
CREATE POLICY "Anonymous worksheets accessible"
ON public.worksheets FOR SELECT TO anon, authenticated
USING (teacher_id IS NULL);

CREATE POLICY "Anonymous worksheets insertable"
ON public.worksheets FOR INSERT TO anon, authenticated
WITH CHECK (teacher_id IS NULL);

CREATE POLICY "Anonymous worksheets updatable"
ON public.worksheets FOR UPDATE TO anon, authenticated
USING (teacher_id IS NULL)
WITH CHECK (teacher_id IS NULL);

REVOKE DELETE ON public.worksheets FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.worksheets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksheets TO authenticated;
GRANT ALL ON public.worksheets TO service_role;

-- === worksheet_student_answers ===
DROP POLICY IF EXISTS "Anyone can view worksheet answers" ON public.worksheet_student_answers;
DROP POLICY IF EXISTS "Anyone can insert worksheet answers" ON public.worksheet_student_answers;
DROP POLICY IF EXISTS "Anyone can update worksheet answers" ON public.worksheet_student_answers;

CREATE POLICY "Teachers view own worksheet answers"
ON public.worksheet_student_answers FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.worksheets w
  WHERE w.id = worksheet_student_answers.worksheet_id AND w.teacher_id = auth.uid()
));

CREATE POLICY "Teachers update own worksheet answers"
ON public.worksheet_student_answers FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.worksheets w
  WHERE w.id = worksheet_student_answers.worksheet_id AND w.teacher_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.worksheets w
  WHERE w.id = worksheet_student_answers.worksheet_id AND w.teacher_id = auth.uid()
));

REVOKE ALL ON public.worksheet_student_answers FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.worksheet_student_answers TO authenticated;
GRANT ALL ON public.worksheet_student_answers TO service_role;

-- === user_events ===
DROP POLICY IF EXISTS "User events access policy" ON public.user_events;

CREATE POLICY "Admins read user events"
ON public.user_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.user_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_events FROM authenticated;
GRANT SELECT ON public.user_events TO authenticated;
GRANT ALL ON public.user_events TO service_role;
