-- PROBLEM: public.worksheets.prompt (the protected Worksheet Generation Engine system
--   prompt) and public.worksheets.ip_address were readable by anon and authenticated
--   through the table-level SELECT grant (RLS filters rows, not columns), so any
--   teacher could read the full model prompt of their own worksheets over REST.
-- SOLUTION: the client now selects explicit columns only (src/lib/worksheet/worksheetColumns.ts).
--   REVOKE SELECT ON TABLE first (a column-level REVOKE is a no-op while a table-level
--   grant exists), then GRANT SELECT on every column except prompt and ip_address.
--   INSERT/UPDATE/DELETE grants are untouched (prompt is still writable, e.g. the
--   duplicate placeholder); service_role and SECURITY DEFINER functions keep full access.
--   A new worksheets column is NOT readable by anon/authenticated until it is added to
--   the GRANT SELECT list below (see supabase/AGENTS.md).
-- ROLLBACK: GRANT SELECT ON public.worksheets TO anon, authenticated;

REVOKE SELECT ON public.worksheets FROM anon, authenticated;

GRANT SELECT (
  id, form_data, ai_response, html_content, user_id, status, generation_time_seconds,
  title, created_at, last_modified_at, download_count, student_id, teacher_id,
  teacher_email, share_token, deleted_at, sequence_number, user_agent, session_id,
  referrer_url, country, city, media_metadata, selected_image, audio_url,
  audio_transcript, audio_duration, audio_voice, selected_audio, share_recipient_email,
  share_expires_at, is_public, public_slug, published_at, public_view_count,
  public_topic, public_level, public_exercise_types, last_shared_at
) ON public.worksheets TO anon, authenticated;
