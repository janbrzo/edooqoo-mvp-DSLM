-- 1. calendar_notifications: remove public insert, add token-validated RPC
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.calendar_notifications;

CREATE POLICY "Teachers insert own notifications"
ON public.calendar_notifications FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid());

REVOKE INSERT ON public.calendar_notifications FROM anon;

CREATE OR REPLACE FUNCTION public.insert_public_booking_notification(
  p_teacher_id uuid,
  p_notification_type text,
  p_message text,
  p_student_name text DEFAULT NULL,
  p_slot_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_notification_type NOT IN ('new_student','booking_confirmed','booking_pending','reschedule_request','cancellation') THEN
    RAISE EXCEPTION 'Invalid notification type';
  END IF;

  -- Teacher must have a public booking page enabled
  IF NOT EXISTS (
    SELECT 1 FROM public.calendar_settings cs
    WHERE cs.teacher_id = p_teacher_id
      AND (cs.public_calendar_token IS NOT NULL OR cs.public_calendar_slug IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Public booking not enabled for this teacher';
  END IF;

  -- Slot (when provided) must belong to that teacher
  IF p_slot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.calendar_slots s WHERE s.id = p_slot_id AND s.teacher_id = p_teacher_id
  ) THEN
    RAISE EXCEPTION 'Slot does not belong to teacher';
  END IF;

  INSERT INTO public.calendar_notifications (teacher_id, notification_type, message, student_name, slot_id, metadata)
  VALUES (p_teacher_id, p_notification_type, left(p_message, 500), left(p_student_name, 200), p_slot_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_public_booking_notification(uuid, text, text, text, uuid, jsonb) TO anon, authenticated;

-- 2. calendar_slot_logs: owner-only inserts
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.calendar_slot_logs;

CREATE POLICY "Teachers insert own slot logs"
ON public.calendar_slot_logs FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid());

REVOKE INSERT ON public.calendar_slot_logs FROM anon;

-- 3. calendar_teacher_vacations: no public read
DROP POLICY IF EXISTS "Public can view vacations" ON public.calendar_teacher_vacations;
REVOKE SELECT ON public.calendar_teacher_vacations FROM anon;

-- 4. feedbacks: remove blanket anonymous update, add time-boxed RPC
DROP POLICY IF EXISTS "feedbacks_update_anonymous_by_record_id" ON public.feedbacks;
REVOKE UPDATE ON public.feedbacks FROM anon;

CREATE OR REPLACE FUNCTION public.update_anonymous_feedback_comment(
  p_id uuid,
  p_comment text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.feedbacks
  SET comment = left(p_comment, 2000)
  WHERE id = p_id
    AND user_id IS NULL
    AND created_at > now() - interval '1 hour';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_anonymous_feedback_comment(uuid, text) TO anon, authenticated;

-- 5. pending_worksheet_ai_evaluations: backend only
DROP POLICY IF EXISTS "Allow insert for pending evaluations" ON public.pending_worksheet_ai_evaluations;
DROP POLICY IF EXISTS "Service role can update pending" ON public.pending_worksheet_ai_evaluations;

CREATE POLICY "Service role manages pending evaluations"
ON public.pending_worksheet_ai_evaluations FOR ALL TO service_role
USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.pending_worksheet_ai_evaluations FROM anon, authenticated;

-- 6. processed_upgrade_sessions: backend only
DROP POLICY IF EXISTS "Edge functions can manage processed sessions" ON public.processed_upgrade_sessions;

CREATE POLICY "Service role manages processed sessions"
ON public.processed_upgrade_sessions FOR ALL TO service_role
USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.processed_upgrade_sessions FROM anon, authenticated;

-- 7. token_transactions: only backend can write
DROP POLICY IF EXISTS "Allow edge functions to create token transactions" ON public.token_transactions;

CREATE POLICY "Service role creates token transactions"
ON public.token_transactions FOR INSERT TO service_role
WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.token_transactions FROM anon, authenticated;

-- 8. worksheet_drawings: owner or shared worksheet only
DROP POLICY IF EXISTS "Anyone can view worksheet drawings" ON public.worksheet_drawings;

CREATE POLICY "Owner or shared worksheet can view drawings"
ON public.worksheet_drawings FOR SELECT
USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = worksheet_drawings.worksheet_id
      AND (w.share_token IS NOT NULL OR w.is_public = true)
  )
);