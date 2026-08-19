---
name: Worksheet failure alert taxonomy
description: Which worksheet generation events are incidents (email + error_logs) vs client input errors vs quality signals
type: feature
---
Three classes, enforced in `notify-generation-failure` and `generateWorksheet`:

- `validation` = CLIENT INPUT ERROR (prompt over 5000 chars). Never email, never `error_logs`.
  Blocked client-side: `useWorksheetGeneration` checks the exact `fullPrompt.length` against
  `PROMPT_HARD_LIMIT` before starting generation; `FormField` enforces `FIELD_LIMITS`.
- `parse_recovered` = QUALITY SIGNAL. Amber email, `error_logs` severity `warning`.
- everything else = REAL FAILURE. Red email, severity `error`.

Email dedup: identical (errorType, userId) within 10 minutes sends one email; the log row is
always written. Admin view `/admin/error-logs` filters by `error_code` and shows a 7-day rollup.
