-- Profile v2 backfill (decision D15, step G_profile_v2): audited, service-only writer.
--
-- public.backfill_profile_v2(p_run_id, p_items, p_dry_run) writes the v2 columns
-- (traits, learning_path, divergences, answer_behaviour, signal_coverage) and the
-- raw_answers keys trait_evidence, learning_path and, when the profile has one,
-- __interpretation_version__ of student_learning_profiles rows from a REVIEWED
-- payload produced by scripts/dslm/backfill-profile-v2-dryrun.mjs
-- (--emit-payload, ids as full uuids, payload kept out of the repository):
--   [{ profile_id, welcome_test_id, expected:{traits, learning_path},
--      after:{traits, learning_path, divergences, answer_behaviour,
--             signal_coverage, trait_evidence} }]
-- Nothing else changes: answers (wt_* keys), typed trait columns, level, scores,
-- ai_summary, welcome_test_id, events, students. Design and order of steps:
-- docs/operational/profile-v2-backfill-plan.md.
--
-- Safety:
--  * At most 50 items per call; the whole call is one transaction.
--  * A row is written only while it still holds the state the dry run saw
--    (traits, learning_path and welcome_test_id equal expected; a SQL NULL
--    column matches a JSON null in expected). A concurrent re-run by a teacher
--    changes that state, so the item is skipped, never overwritten.
--  * A row already equal to the target is skipped, so a second call applies 0.
--  * Every change is recorded in public.dslm_backfill_audit (step G_profile_v2,
--    before and after) BEFORE the update. Reverting a row means updating it
--    from the audit before image.
--  * p_dry_run = true (the default) writes nothing and reports the counts.
--  * The BEFORE UPDATE trigger of the table moves updated_at to now(); the old
--    value is kept in the audit.
--  * Callable by service_role only (REVOKE for PUBLIC, anon, authenticated). The
--    function runs as its owner, so current_user is the owner inside it; the
--    caller is therefore judged by session_user and the JWT role: a PostgREST
--    request (session_user authenticator) must carry the service_role claim,
--    a direct database session (SQL editor, migration runner, MCP SQL tool) is
--    trusted because EXECUTE is granted to service_role only.

CREATE OR REPLACE FUNCTION public.backfill_profile_v2(
  p_run_id text,
  p_items jsonb,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  c_step CONSTANT text := 'G_profile_v2';
  c_max_items CONSTANT integer := 50;
  v_item jsonb;
  v_after jsonb;
  v_expected jsonb;
  v_row public.student_learning_profiles%ROWTYPE;
  v_before jsonb;
  v_audit_after jsonb;
  v_stamp jsonb;
  v_new_raw jsonb;
  v_status text;
  v_results jsonb := '[]'::jsonb;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_not_found integer := 0;
  v_state_mismatch integer := 0;
  v_unchanged integer := 0;
  v_locked integer := 0;
  v_profile_id uuid;
  v_test_id uuid;
BEGIN
  IF NOT (
    coalesce(auth.role(), '') = 'service_role'
    OR session_user <> 'authenticator'
  ) THEN
    RAISE EXCEPTION 'backfill_profile_v2 is service only' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL OR btrim(p_run_id) = '' THEN
    RAISE EXCEPTION 'p_run_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > c_max_items THEN
    RAISE EXCEPTION 'at most % items per call, got %', c_max_items, jsonb_array_length(p_items) USING ERRCODE = '22023';
  END IF;
  IF to_regclass('public.dslm_backfill_audit') IS NULL THEN
    RAISE EXCEPTION 'public.dslm_backfill_audit is missing (migration 20261012200000)' USING ERRCODE = '42P01';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_profile_id := (v_item ->> 'profile_id')::uuid;
    v_test_id := (v_item ->> 'welcome_test_id')::uuid;
    v_after := v_item -> 'after';
    v_expected := v_item -> 'expected';
    IF v_profile_id IS NULL OR v_test_id IS NULL
       OR jsonb_typeof(v_after) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_expected) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_after -> 'traits') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_after -> 'learning_path') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_after -> 'divergences') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_after -> 'answer_behaviour') IS DISTINCT FROM 'object'
       OR NOT (v_after ? 'trait_evidence') THEN
      RAISE EXCEPTION 'invalid payload item for profile %', coalesce(v_item ->> 'profile_id', '?') USING ERRCODE = '22023';
    END IF;

    v_status := NULL;
    SELECT * INTO v_row FROM public.student_learning_profiles
      WHERE id = v_profile_id FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.student_learning_profiles WHERE id = v_profile_id) THEN
        v_status := 'locked';
        v_locked := v_locked + 1;
      ELSE
        v_status := 'not_found';
        v_not_found := v_not_found + 1;
      END IF;
      v_skipped := v_skipped + 1;
    ELSIF v_row.traits IS DISTINCT FROM nullif(v_expected -> 'traits', 'null'::jsonb)
       OR v_row.learning_path IS DISTINCT FROM nullif(v_expected -> 'learning_path', 'null'::jsonb)
       OR v_row.welcome_test_id IS DISTINCT FROM v_test_id THEN
      v_status := 'state_mismatch';
      v_state_mismatch := v_state_mismatch + 1;
      v_skipped := v_skipped + 1;
    ELSIF v_row.traits IS NOT DISTINCT FROM (v_after -> 'traits')
       AND v_row.learning_path IS NOT DISTINCT FROM (v_after -> 'learning_path')
       AND v_row.divergences IS NOT DISTINCT FROM (v_after -> 'divergences')
       AND v_row.answer_behaviour IS NOT DISTINCT FROM (v_after -> 'answer_behaviour')
       AND v_row.signal_coverage IS NOT DISTINCT FROM (v_after ->> 'signal_coverage')::numeric
       AND coalesce(v_row.raw_answers, '{}'::jsonb) -> 'trait_evidence' IS NOT DISTINCT FROM (v_after -> 'trait_evidence')
       AND coalesce(v_row.raw_answers, '{}'::jsonb) -> 'learning_path' IS NOT DISTINCT FROM (v_after -> 'learning_path') THEN
      v_status := 'unchanged';
      v_unchanged := v_unchanged + 1;
      v_skipped := v_skipped + 1;
    ELSE
      v_status := CASE WHEN p_dry_run THEN 'would_apply' ELSE 'applied' END;
      v_stamp := CASE
        WHEN (v_after -> 'traits') ? '__interpretation_version__'
        THEN jsonb_build_object('__interpretation_version__', v_after -> 'traits' -> '__interpretation_version__')
        ELSE '{}'::jsonb
      END;
      v_new_raw := coalesce(v_row.raw_answers, '{}'::jsonb)
        || jsonb_build_object('trait_evidence', v_after -> 'trait_evidence', 'learning_path', v_after -> 'learning_path')
        || v_stamp;

      IF NOT p_dry_run THEN
        v_before := jsonb_build_object(
          'traits', v_row.traits,
          'learning_path', v_row.learning_path,
          'divergences', v_row.divergences,
          'answer_behaviour', v_row.answer_behaviour,
          'signal_coverage', v_row.signal_coverage,
          'updated_at', v_row.updated_at,
          'welcome_test_id', v_row.welcome_test_id,
          'student_id', v_row.student_id,
          'raw_answers_keys', jsonb_build_object(
            'trait_evidence', coalesce(v_row.raw_answers, '{}'::jsonb) -> 'trait_evidence',
            'learning_path', coalesce(v_row.raw_answers, '{}'::jsonb) -> 'learning_path',
            '__interpretation_version__', coalesce(v_row.raw_answers, '{}'::jsonb) -> '__interpretation_version__'));
        v_audit_after := jsonb_build_object(
          'traits', v_after -> 'traits',
          'learning_path', v_after -> 'learning_path',
          'divergences', v_after -> 'divergences',
          'answer_behaviour', v_after -> 'answer_behaviour',
          'signal_coverage', v_after -> 'signal_coverage',
          'raw_answers_keys', jsonb_build_object(
            'trait_evidence', v_after -> 'trait_evidence',
            'learning_path', v_after -> 'learning_path',
            '__interpretation_version__', v_stamp -> '__interpretation_version__'));

        INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
        VALUES (p_run_id, c_step, 'student_learning_profiles', v_row.id::text, v_before, v_audit_after);

        UPDATE public.student_learning_profiles SET
          traits = v_after -> 'traits',
          learning_path = v_after -> 'learning_path',
          divergences = v_after -> 'divergences',
          answer_behaviour = v_after -> 'answer_behaviour',
          signal_coverage = (v_after ->> 'signal_coverage')::numeric,
          raw_answers = v_new_raw
        WHERE id = v_row.id;
      END IF;
      v_applied := v_applied + 1;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object('profile_id', v_profile_id, 'status', v_status));
  END LOOP;

  RETURN jsonb_build_object(
    'run_id', p_run_id,
    'step', c_step,
    'dry_run', p_dry_run,
    'items', jsonb_array_length(p_items),
    'applied', v_applied,
    'skipped', v_skipped,
    'not_found', v_not_found,
    'state_mismatch', v_state_mismatch,
    'unchanged', v_unchanged,
    'locked', v_locked,
    'results', v_results);
END
$fn$;

REVOKE ALL ON FUNCTION public.backfill_profile_v2(text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_profile_v2(text, jsonb, boolean) TO service_role;
