ALTER TABLE public.student_learning_profiles
  ADD COLUMN IF NOT EXISTS idk_count_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idk_count_skill integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_awareness_score integer;

COMMENT ON COLUMN public.student_learning_profiles.idk_count_total IS 'v6.9.56: total number of "I don''t know" answers in the most recent welcome test';
COMMENT ON COLUMN public.student_learning_profiles.idk_count_skill IS 'v6.9.56: IDK count on skill questions (grammar, vocabulary, reading, listening, writing, speaking)';
COMMENT ON COLUMN public.student_learning_profiles.self_awareness_score IS 'v6.9.56: 0-100 score measuring consistency between IDK rate on skill questions and actual skill score. High = honest self-perception.';