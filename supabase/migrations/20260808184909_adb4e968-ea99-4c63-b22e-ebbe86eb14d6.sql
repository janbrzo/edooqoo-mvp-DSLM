DROP POLICY IF EXISTS "Anonymous worksheets accessible" ON public.worksheets;
DROP POLICY IF EXISTS "Anonymous worksheets updatable" ON public.worksheets;

CREATE POLICY "Anonymous worksheets accessible (fresh only)"
ON public.worksheets
FOR SELECT
TO anon, authenticated
USING (teacher_id IS NULL AND created_at > now() - interval '6 hours');

CREATE POLICY "Anonymous worksheets updatable (fresh only)"
ON public.worksheets
FOR UPDATE
TO anon, authenticated
USING (teacher_id IS NULL AND created_at > now() - interval '6 hours')
WITH CHECK (teacher_id IS NULL);