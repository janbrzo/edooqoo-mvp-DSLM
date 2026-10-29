-- Phase 2 / step 7 (P2.3): keep the untouched model text of a generated worksheet.
--
-- PROBLEM: generateWorksheet saved the raw model text in ai_response and the normalised
--   worksheet in html_content, so readers saw different versions of one worksheet. The fix is
--   to store the canonical worksheet in both of those columns for new rows, which would lose the
--   raw model text that is still needed for diagnostics.
-- SOLUTION (additive only): public.worksheets.ai_response_raw text, nullable, written only by
--   the generateWorksheet INSERT (service role). NO GRANT SELECT to anon or authenticated: the
--   table-level SELECT was revoked by 20261028121000, so a new column is unreadable by client
--   roles until it is granted, and it deliberately never is. It is listed in
--   WORKSHEET_FORBIDDEN_COLUMNS (src/lib/worksheet/worksheetColumns.ts) so no client query can
--   name it. Old rows keep NULL. No DROP, no data rewrite.
-- ROLLBACK: set the CANONICAL_SAVE secret to off (the function stops writing the column);
--   the column can stay, it is nullable and unread.

ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS ai_response_raw text;

COMMENT ON COLUMN public.worksheets.ai_response_raw IS
  'Untouched model text (em dash cleaned, capped at 200000 chars), written at INSERT only; not readable by anon or authenticated.';
