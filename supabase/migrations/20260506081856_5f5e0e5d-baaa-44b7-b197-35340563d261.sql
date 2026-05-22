ALTER TABLE public.student_knowledge_entries
  ADD COLUMN IF NOT EXISTS ai_classified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_in_worksheet_id UUID REFERENCES public.worksheets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ske_archived_at ON public.student_knowledge_entries(archived_at);
CREATE INDEX IF NOT EXISTS idx_ske_used_in_worksheet ON public.student_knowledge_entries(used_in_worksheet_id);