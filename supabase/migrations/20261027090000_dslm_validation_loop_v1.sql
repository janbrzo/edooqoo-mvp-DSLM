-- Iteration 10: validation loop v1 (additive, no existing behaviour changes).
-- 1. dslm_interpretation_params: the constants the interpretation layer uses today, version 1.
--    The values are copied from code and checked by src/lib/__tests__/dslmParamsParity.test.ts.
-- 2. param_version on student_skill_metrics and pacing_proposals (metadata only, nothing reads it yet).
-- 3. dslm_decision_log + log_dslm_decision RPC: teacher decisions that are lost today.
-- The Mark done prior_verdict argument lives in 20261027090200_save_mark_done_replace_signature.sql.

-- 1. Interpretation parameters ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dslm_interpretation_params (
  id bigserial PRIMARY KEY,
  version integer NOT NULL,
  name text NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dslm_interpretation_params_version_name_key UNIQUE (version, name)
);

ALTER TABLE public.dslm_interpretation_params ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dslm_interpretation_params FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.dslm_interpretation_params TO service_role;
REVOKE ALL ON SEQUENCE public.dslm_interpretation_params_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.dslm_interpretation_params_id_seq TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dslm_interpretation_params'
      AND policyname = 'Service role full access dslm_interpretation_params'
  ) THEN
    CREATE POLICY "Service role full access dslm_interpretation_params"
      ON public.dslm_interpretation_params FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.dslm_interpretation_params (version, name, value, description) VALUES
  ('1', 'metric.decay_per_day', '0.03', 'compute_skill_metric: exp(-decay * age in days) weight of an event point'),
  ('1', 'metric.trend_recent_points', '3', 'compute_skill_metric: newest points in the recent trend window'),
  ('1', 'metric.trend_older_points', '3', 'compute_skill_metric: points before the recent window in the older trend window'),
  ('1', 'metric.trend_threshold', '10', 'compute_skill_metric: difference of window means (points) that makes a trend improving or declining'),
  ('1', 'metric.min_points_for_trend', '4', 'compute_skill_metric: fewer points give trend insufficient_data'),
  ('1', 'metric.history_points', '20', 'compute_skill_metric: points kept in mastery_history'),
  ('1', 'forgetting.grace_days', '14', 'forgetting.ts: days without decay'),
  ('1', 'forgetting.half_life_days', '60', 'forgetting.ts: half-life after the grace period'),
  ('1', 'forgetting.floor', '0.5', 'forgetting.ts: share of the stored mastery that never decays'),
  ('1', 'lps.version', '3', 'learningPathScore.ts: Learning Path Score algorithm version'),
  ('1', 'lps.weights', '{"deadline_response":0.10,"learning_timeline":0.15,"persistence_level":0.10,"career_importance":0.10,"usage_context":0.05,"motivation_type":0.06,"ambiguity_tolerance":0.06,"weekly_study_time":0.07,"anxiety_level":0.06,"learning_duration":0.04,"learning_autonomy":0.04,"error_attitude":0.05,"reading_strategy":0.04,"feedback_preference":0.04,"confidence_overall":0.04}', 'learningPathScore.ts WEIGHTS (sum 1)'),
  ('1', 'lps.low_capacity_cap', '50', 'learningPathScore.ts: score cap for low capacity (top of guided)'),
  ('1', 'lps.low_capacity_urgent_cap', '75', 'learningPathScore.ts: cap for low capacity with urgent need (v2 only)'),
  ('1', 'lps.path_thresholds', '{"guided":26,"accelerated":51,"target":76}', 'learningPathScore.ts pathForScore: minimum score of each path, below 26 is comfort'),
  ('1', 'pacing.proposal_max_age_days', '14', 'pacing.ts PACING_PROPOSAL_MAX_AGE_DAYS: a pending proposal expires after this many days'),
  ('1', 'pacing.default_mode', '50', 'pacing.ts DEFAULT_PACING_MODE'),
  ('1', 'pacing.min_evidence_events', '3', 'pacing.ts MIN_PACING_EVIDENCE_EVENTS'),
  ('1', 'pacing.min_evidence_skills', '2', 'pacing.ts MIN_PACING_EVIDENCE_SKILLS'),
  ('1', 'pacing.stale_deadline_days', '14', 'pacing.ts STALE_DEADLINE_DAYS')
ON CONFLICT (version, name) DO NOTHING;

-- 2. param_version columns --------------------------------------------------------

ALTER TABLE public.student_skill_metrics ADD COLUMN IF NOT EXISTS param_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.pacing_proposals ADD COLUMN IF NOT EXISTS param_version integer NOT NULL DEFAULT 1;

-- 3. Decision log -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dslm_decision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN (
    'mark_done_prior_verdict', 'ai_raise_applied', 'ai_raise_reverted',
    'pacing_proposal_seen', 'pacing_proposal_dismissed', 'pacing_proposal_accepted',
    'level_suggestion_accepted', 'level_suggestion_dismissed'
  )),
  source_id text,
  param_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS dslm_decision_log_teacher_type_created_idx
  ON public.dslm_decision_log (teacher_id, decision_type, created_at);

ALTER TABLE public.dslm_decision_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dslm_decision_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dslm_decision_log TO authenticated;
GRANT ALL ON public.dslm_decision_log TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dslm_decision_log'
      AND policyname = 'Teachers can view their own decision log'
  ) THEN
    CREATE POLICY "Teachers can view their own decision log"
      ON public.dslm_decision_log FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dslm_decision_log'
      AND policyname = 'Service role full access dslm_decision_log'
  ) THEN
    CREATE POLICY "Service role full access dslm_decision_log"
      ON public.dslm_decision_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.log_dslm_decision(
  p_student_id uuid,
  p_decision_type text,
  p_source_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid := auth.uid();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_version integer;
  v_id uuid;
BEGIN
  -- Same ownership rule as add_student_event: the caller must be the teacher of the student.
  IF v_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.teacher_id = v_teacher_id
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_decision_type IS NULL OR p_decision_type NOT IN (
    'mark_done_prior_verdict', 'ai_raise_applied', 'ai_raise_reverted',
    'pacing_proposal_seen', 'pacing_proposal_dismissed', 'pacing_proposal_accepted',
    'level_suggestion_accepted', 'level_suggestion_dismissed'
  ) THEN
    RAISE EXCEPTION 'Unknown decision_type' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_payload must be an object' USING ERRCODE = '22023';
  END IF;
  IF octet_length(v_payload::text) > 8192 THEN
    RAISE EXCEPTION 'p_payload is too large' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(max(version), 1) INTO v_version FROM public.dslm_interpretation_params;

  INSERT INTO public.dslm_decision_log (teacher_id, student_id, decision_type, source_id, param_version, payload)
  VALUES (v_teacher_id, p_student_id, p_decision_type, left(p_source_id, 200), v_version, v_payload)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_dslm_decision(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_dslm_decision(uuid, text, text, jsonb) TO authenticated, service_role;
