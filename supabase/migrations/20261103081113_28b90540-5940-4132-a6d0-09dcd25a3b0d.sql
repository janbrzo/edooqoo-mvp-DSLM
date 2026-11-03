ALTER TABLE public.students ADD COLUMN IF NOT EXISTS learning_track text NOT NULL DEFAULT 'general';
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_learning_track_check;
ALTER TABLE public.students ADD CONSTRAINT students_learning_track_check
  CHECK (learning_track IN ('business','exam','general','travel','academic','social','relocation','custom'));

UPDATE public.students SET learning_track = CASE lower(coalesce(main_goal,''))
  WHEN 'work' THEN 'business'
  WHEN 'exam' THEN 'exam'
  WHEN 'travel' THEN 'travel'
  WHEN 'academic' THEN 'academic'
  WHEN 'social-conversation' THEN 'social'
  WHEN 'general' THEN 'general'
  WHEN 'personal-development' THEN 'general'
  WHEN 'fun-entertainment' THEN 'general'
  WHEN '' THEN 'general'
  ELSE 'custom' END
WHERE learning_track = 'general';

ALTER TABLE public.student_progress_goals ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'milestone';
ALTER TABLE public.student_progress_goals ADD COLUMN IF NOT EXISTS target_category text NOT NULL DEFAULT 'general';
ALTER TABLE public.student_progress_goals DROP CONSTRAINT IF EXISTS student_progress_goals_kind_check;
ALTER TABLE public.student_progress_goals ADD CONSTRAINT student_progress_goals_kind_check
  CHECK (kind IN ('milestone','skill','task'));

UPDATE public.student_progress_goals
SET kind = 'skill',
    target_category = CASE WHEN metadata->>'value' IN ('grammar','vocabulary','reading','writing','speaking','listening') THEN metadata->>'value' ELSE 'general' END
WHERE source = 'welcome_test_auto' AND metadata->>'signal' IN ('weakest_skill','strongest_skill');

CREATE INDEX IF NOT EXISTS idx_student_progress_goals_kind_cat
  ON public.student_progress_goals (student_id, kind, target_category);