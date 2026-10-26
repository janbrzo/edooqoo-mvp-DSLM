-- DSLM validation loop v1, item 4: read-only validation report for the owner.
-- One aggregate jsonb over all students: counts and statistics only, no student ids,
-- no names, no emails. Executable by service_role only (owner/admin view).
-- It never changes data and never feeds the worksheet engine. Minimum n per section
-- comes from the audit table: Mark done 150, ai raise 100, predictive 30, WT 40, pacing 100.
-- The optional table dslm_decision_log is read through dynamic SQL behind to_regclass,
-- so the function also works before that table exists.

CREATE OR REPLACE FUNCTION public.dslm_validation_report()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_log boolean := to_regclass('public.dslm_decision_log') IS NOT NULL;
  v_md jsonb;
  v_ai jsonb;
  v_pacing jsonb;
  v_fc jsonb;
  v_wt jsonb;
  v_cov jsonb;
  v_pred jsonb;
  v_applied bigint := 0;
  v_reverted bigint := 0;
  v_seen bigint := 0;
  v_log_acc bigint := 0;
  v_log_dis bigint := 0;
BEGIN
  IF v_has_log THEN
    EXECUTE $q$
      SELECT
        count(*) FILTER (WHERE decision_type = 'ai_raise_applied'),
        count(*) FILTER (WHERE decision_type = 'ai_raise_reverted'),
        count(*) FILTER (WHERE decision_type = 'pacing_proposal_seen'),
        count(*) FILTER (WHERE decision_type = 'pacing_proposal_accepted'),
        count(*) FILTER (WHERE decision_type = 'pacing_proposal_dismissed')
      FROM public.dslm_decision_log
    $q$ INTO v_applied, v_reverted, v_seen, v_log_acc, v_log_dis;
  END IF;

  -- (1) Mark done vs the student or AI value of the same skill in the same exercise.
  -- A pair is one Mark done skill rating with at least one comparable rating.
  -- Values 30 and 80 without a prior_verdict are saved defaults and are excluded.
  WITH md AS (
    SELECT e.id AS eid, e.source_id, e.event_payload ->> 'exercise_index' AS ex,
           r ->> 'name' AS skill, (r ->> 'mastery')::numeric AS m,
           (e.event_payload ? 'prior_verdict') AS has_prior
    FROM public.student_events e,
         jsonb_array_elements(CASE WHEN jsonb_typeof(e.event_payload -> 'nano_skill_ratings') = 'array'
                                   THEN e.event_payload -> 'nano_skill_ratings' ELSE '[]'::jsonb END) r
    WHERE e.event_type = 'mark_done_evaluation' AND e.superseded_at IS NULL
      AND r ->> 'hasValue' = 'true' AND r ->> 'mastery' IS NOT NULL
  ), o AS (
    SELECT e.source_id, e.event_payload ->> 'exercise_index' AS ex, r ->> 'name' AS skill,
           avg((r ->> 'mastery')::numeric) AS m
    FROM public.student_events e,
         jsonb_array_elements(CASE WHEN jsonb_typeof(e.event_payload -> 'nano_skill_ratings') = 'array'
                                   THEN e.event_payload -> 'nano_skill_ratings' ELSE '[]'::jsonb END) r
    WHERE e.event_type <> 'mark_done_evaluation' AND e.event_source IN ('worksheet', 'homework')
      AND e.superseded_at IS NULL AND r ->> 'hasValue' = 'true' AND r ->> 'mastery' IS NOT NULL
    GROUP BY 1, 2, 3
  ), pairs AS (
    SELECT md.eid, md.m AS md_m, o.m AS o_m, md.has_prior,
           (md.m IN (30, 80) AND NOT md.has_prior) AS is_default
    FROM md JOIN o ON o.source_id = md.source_id AND o.ex = md.ex AND o.skill = md.skill
  )
  SELECT jsonb_build_object(
    'n', count(*) FILTER (WHERE NOT is_default),
    'min_n', 150,
    'sufficient', count(*) FILTER (WHERE NOT is_default) >= 150,
    'comparable_pairs_total', count(*),
    'excluded_saved_defaults', count(*) FILTER (WHERE is_default),
    'pairs_with_prior_verdict', count(*) FILTER (WHERE has_prior),
    'mark_done_events_used', count(DISTINCT eid) FILTER (WHERE NOT is_default),
    'mean_abs_difference', round(avg(abs(md_m - o_m)) FILTER (WHERE NOT is_default), 2),
    'mean_abs_difference_with_prior_verdict', round(avg(abs(md_m - o_m)) FILTER (WHERE has_prior), 2)
  ) INTO v_md FROM pairs;

  -- (2) AI raises (rating source ai_alternative) and the revert rate from the decision log.
  WITH raises AS (
    SELECT e.id,
           jsonb_array_length(jsonb_path_query_array(e.event_payload,
             '$.nano_skill_ratings[*] ? (@.source == "ai_alternative")')) AS c
    FROM public.student_events e
    WHERE e.superseded_at IS NULL AND e.event_payload::text LIKE '%ai_alternative%'
  )
  SELECT jsonb_build_object(
    'n', COALESCE(sum(c), 0),
    'min_n', 100,
    'sufficient', COALESCE(sum(c), 0) >= 100,
    'events_with_raise', count(*) FILTER (WHERE c > 0),
    'decision_log_available', v_has_log,
    'raises_applied_logged', v_applied,
    'raises_reverted_logged', v_reverted,
    'revert_rate', CASE WHEN v_applied > 0 THEN round(v_reverted::numeric / v_applied, 3) END
  ) INTO v_ai FROM raises;

  -- (3) Pacing proposals: decisions the teacher took versus all outcomes.
  SELECT jsonb_build_object(
    'n', count(*) FILTER (WHERE status IN ('accepted', 'rejected')),
    'min_n', 100,
    'sufficient', count(*) FILTER (WHERE status = 'accepted') >= 100
                  AND count(*) FILTER (WHERE status = 'rejected') >= 100,
    'accepted', count(*) FILTER (WHERE status = 'accepted'),
    'dismissed', count(*) FILTER (WHERE status = 'rejected'),
    'superseded', count(*) FILTER (WHERE status = 'superseded'),
    'pending', count(*) FILTER (WHERE status = 'pending'),
    'total', count(*),
    'decision_rate', CASE WHEN count(*) > 0 THEN
      round(count(*) FILTER (WHERE status IN ('accepted', 'rejected'))::numeric / count(*), 3) END,
    'decision_rate_excluding_superseded', CASE WHEN count(*) FILTER (WHERE status <> 'superseded') > 0 THEN
      round(count(*) FILTER (WHERE status IN ('accepted', 'rejected'))::numeric
            / count(*) FILTER (WHERE status <> 'superseded'), 3) END,
    'decision_log_available', v_has_log,
    'seen_logged', v_seen,
    'accepted_logged', v_log_acc,
    'dismissed_logged', v_log_dis
  ) INTO v_pacing FROM public.pacing_proposals;

  -- (4) Flashcard decay check: next review mastery of the same card predicted by
  -- the last mastery decayed by exp(-rate * days), the card running mean and constant 50.
  -- Rate 0 equals the last value. Mastery is on a 0-100 scale, no floor is applied.
  WITH f AS (
    SELECT student_id, mastery AS y, created_at AS at,
           lag(mastery) OVER w AS last_m, lag(created_at) OVER w AS last_at,
           avg(mastery) OVER (PARTITION BY student_id, event_payload ->> 'card_id'
                              ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS rmean,
           event_payload ->> 'card_id' AS cid
    FROM public.student_events
    WHERE event_source = 'flashcard' AND mastery IS NOT NULL AND superseded_at IS NULL
      AND event_payload ->> 'card_id' IS NOT NULL
    WINDOW w AS (PARTITION BY student_id, event_payload ->> 'card_id' ORDER BY created_at, id)
  ), t AS (
    SELECT *, greatest(extract(epoch FROM (at - last_at)) / 86400.0, 0) AS d FROM f WHERE last_m IS NOT NULL
  )
  SELECT jsonb_build_object(
    'n', count(*),
    'min_n', 30,
    'sufficient', count(*) >= 30,
    'cards', count(DISTINCT (student_id, cid)),
    'mean_days_between_reviews', round(avg(d), 2),
    'mae_last_value', round(avg(abs(y - last_m)), 2),
    'mae_running_mean', round(avg(abs(y - rmean)), 2),
    'mae_constant_50', round(avg(abs(y - 50)), 2),
    'mae_decay_by_rate', jsonb_build_object(
      '0.01', round(avg(abs(y - last_m * exp(-0.01 * d))), 2),
      '0.02', round(avg(abs(y - last_m * exp(-0.02 * d))), 2),
      '0.03', round(avg(abs(y - last_m * exp(-0.03 * d))), 2),
      '0.05', round(avg(abs(y - last_m * exp(-0.05 * d))), 2),
      '0.08', round(avg(abs(y - last_m * exp(-0.08 * d))), 2))
  ) INTO v_fc FROM t;

  -- (5) Welcome Test estimated level (latest profile per student) versus mean skill
  -- mastery of non flashcard skills last touched after the profile was created.
  WITH prof AS (
    SELECT DISTINCT ON (student_id) student_id, created_at,
           CASE estimated_level WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
                                WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6 END AS lvl
    FROM public.student_learning_profiles
    WHERE estimated_level IS NOT NULL
    ORDER BY student_id, created_at DESC
  ), x AS (
    SELECT p.student_id, p.lvl, avg(m.current_mastery) AS mm
    FROM prof p
    JOIN public.student_skill_metrics m ON m.student_id = p.student_id
      AND m.skill_name NOT LIKE 'flashcard:%' AND m.last_event_at > p.created_at
    WHERE p.lvl IS NOT NULL
    GROUP BY p.student_id, p.lvl
  )
  SELECT jsonb_build_object(
    'n', count(*),
    'min_n', 40,
    'sufficient', count(*) >= 40,
    'correlation_level_vs_mastery', round(corr(lvl, mm)::numeric, 3),
    'status', CASE WHEN count(*) < 40 THEN 'insufficient' ELSE 'ok' END
  ) INTO v_wt FROM x;

  -- (6) Skill key coverage. Canonical key ported from canonicalSkill in skillLabels.ts:
  -- strip ns, the CEFR level segment, map the category alias, remove a trailing _vN suffix.
  WITH base AS (
    SELECT skill_name, skill_category, total_events,
           regexp_replace(regexp_replace(lower(btrim(coalesce(skill_name, ''))), '^ns\.', ''),
                          '^(a1|a2|b1|b2|c1|c2)(\.|$)', '') AS s1
    FROM public.student_skill_metrics
  ), seg AS (
    SELECT *, split_part(s1, '.', 1) AS first_seg, position('.' IN s1) > 0 AS has_more,
           CASE split_part(s1, '.', 1) WHEN 'vocab' THEN 'vocabulary' WHEN 'grammar' THEN 'grammar'
             WHEN 'vocabulary' THEN 'vocabulary' WHEN 'reading' THEN 'reading' WHEN 'listening' THEN 'listening'
             WHEN 'speaking' THEN 'speaking' WHEN 'writing' THEN 'writing' WHEN 'spelling' THEN 'spelling'
             WHEN 'pronunciation' THEN 'pronunciation' END AS cat_alias
    FROM base
  ), keyed AS (
    SELECT skill_name, total_events,
           coalesce(CASE WHEN has_more THEN cat_alias END,
                    CASE lower(btrim(coalesce(skill_category, ''))) WHEN 'vocab' THEN 'vocabulary'
                      WHEN '' THEN NULL ELSE lower(btrim(skill_category)) END, 'general') || '|' ||
           coalesce(nullif(regexp_replace(CASE WHEN has_more AND cat_alias IS NOT NULL
                                               THEN substr(s1, length(first_seg) + 2) ELSE s1 END, '_v[0-9]+$', ''), ''),
                    'general') AS ckey
    FROM seg
  ), per_name AS (
    SELECT skill_name, min(ckey) AS ckey, max(total_events) AS max_events, count(*) AS rows_n
    FROM keyed GROUP BY skill_name
  ), per_key AS (
    SELECT ckey, count(*) AS names FROM per_name GROUP BY ckey
  )
  SELECT jsonb_build_object(
    'n', (SELECT count(*) FROM public.student_skill_metrics),
    'min_n', 30,
    'sufficient', (SELECT count(*) FROM public.student_skill_metrics) >= 30,
    'distinct_skill_names', (SELECT count(*) FROM per_name),
    'distinct_canonical_keys', (SELECT count(*) FROM per_key),
    'names_sharing_a_canonical_key', (SELECT coalesce(sum(names), 0) FROM per_key WHERE names > 1),
    'share_names_sharing_a_canonical_key',
      (SELECT round(coalesce(sum(names) FILTER (WHERE names > 1), 0)::numeric / nullif(sum(names), 0), 3) FROM per_key),
    'single_event_metrics', (SELECT count(*) FROM public.student_skill_metrics WHERE total_events = 1),
    'share_single_event_metrics',
      (SELECT round(count(*) FILTER (WHERE total_events = 1)::numeric / nullif(count(*), 0), 3)
         FROM public.student_skill_metrics)
  ) INTO v_cov;

  -- (7) Prediction error from stored mastery history of non flashcard skills with at
  -- least 2 events: each point after the first is predicted by the previous value,
  -- the running mean of the earlier points and constant 50.
  WITH h AS (
    SELECT m.id AS mid, p.ord, (p.v ->> 'mastery')::numeric AS y
    FROM public.student_skill_metrics m,
         jsonb_array_elements(CASE WHEN jsonb_typeof(m.mastery_history) = 'array'
                                   THEN m.mastery_history ELSE '[]'::jsonb END) WITH ORDINALITY p(v, ord)
    WHERE m.skill_name NOT LIKE 'flashcard:%' AND p.v ->> 'mastery' IS NOT NULL
  ), s AS (
    SELECT mid, ord, y, lag(y) OVER (PARTITION BY mid ORDER BY ord) AS last_v,
           avg(y) OVER (PARTITION BY mid ORDER BY ord ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS rmean
    FROM h
  ), t AS (
    SELECT * FROM s WHERE ord >= 2
  )
  SELECT jsonb_build_object(
    'n', count(DISTINCT mid),
    'min_n', 30,
    'sufficient', count(DISTINCT mid) >= 30,
    'predictions', count(*),
    'mae_last_value', round(avg(abs(y - last_v)), 2),
    'mae_running_mean', round(avg(abs(y - rmean)), 2),
    'mae_constant_50', round(avg(abs(y - 50)), 2),
    'correlation_last_vs_next', round(corr(y, last_v)::numeric, 3),
    'audit_reference', jsonb_build_object('last_value', 27.5, 'running_mean', 25.6, 'constant_50', 35.0)
  ) INTO v_pred FROM t;

  RETURN jsonb_build_object(
    'report_version', 1,
    'mark_done_pairs', v_md,
    'ai_raise', v_ai,
    'pacing_decisions', v_pacing,
    'flashcard_decay_check', v_fc,
    'wt_level_vs_mastery', v_wt,
    'skill_key_coverage', v_cov,
    'prediction_error', v_pred
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dslm_validation_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dslm_validation_report() TO service_role;
