DO $$
DECLARE
  internal_only text[] := ARRAY[
    'handle_new_user','handle_email_confirmed','profiles_sync_available_tokens',
    'refresh_skill_metrics_on_event','sync_subscription_to_subscriptions','update_updated_at_column',
    'log_flashcard_review_event','log_homework_answer_to_events','log_knowledge_entry_event',
    'log_test_answer_event','log_worksheet_answer_to_events','clean_old_geolocation_cache',
    'cleanup_worksheet_base64','add_tokens'
  ];
  teacher_only text[] := ARRAY[
    'add_student_event','apply_intake_extraction','rollback_intake_extraction','backfill_skill_metrics',
    'compute_skill_metric','consume_token','get_token_balance','create_mcp_token','find_student_by_email',
    'get_student_tags','get_worksheet_live_answers','generate_flashcard_share_token',
    'generate_homework_share_token','generate_test_share_token','generate_worksheet_share_token',
    'mark_attention_seen','mark_knowledge_current','mark_knowledge_outdated','save_teacher_comment',
    'soft_delete_flashcard_set','soft_delete_knowledge_entry','soft_delete_student',
    'soft_delete_user_account','soft_delete_worksheet','should_show_onboarding'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND (p.proname = ANY(internal_only) OR p.proname = ANY(teacher_only))
  LOOP
    IF r.proname = ANY(internal_only) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    END IF;
  END LOOP;
END $$;