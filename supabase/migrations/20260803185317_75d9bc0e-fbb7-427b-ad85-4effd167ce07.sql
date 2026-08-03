-- feedbacks: remove blanket read/write policies
DROP POLICY IF EXISTS "Anonymous users can view feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Anonymous users can update feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "allow_read_feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "allow_update_feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "allow_delete_feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "allow_insert_feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "Anonymous users can create feedbacks" ON public.feedbacks;

CREATE POLICY "feedbacks_insert_own_or_anonymous"
ON public.feedbacks FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "feedbacks_select_own"
ON public.feedbacks FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "feedbacks_update_own"
ON public.feedbacks FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedbacks_update_anonymous_by_record_id"
ON public.feedbacks FOR UPDATE TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

CREATE POLICY "feedbacks_delete_own"
ON public.feedbacks FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- subscriptions: remove anonymous read and overly broad public write
DROP POLICY IF EXISTS "Anonymous users can view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow edge functions to manage subscriptions" ON public.subscriptions;
REVOKE ALL ON public.subscriptions FROM anon;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- subscription_events: remove anonymous read and overly broad public write
DROP POLICY IF EXISTS "Anonymous users can view subscription_events" ON public.subscription_events;
DROP POLICY IF EXISTS "Allow edge functions to manage subscription events" ON public.subscription_events;
REVOKE ALL ON public.subscription_events FROM anon;
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;