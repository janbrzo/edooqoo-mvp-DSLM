# Welcome Test bank 2: adaptive flow

- Bank 2 = bank 1 (58 rows) + 14 keyed questions wt_q59-wt_q72 appended to the array (indices 58-71), so stored answers keep their meaning.
- A student sees 5 to 10 of the 14: A1 grammar/vocabulary block only after weak A2 answers, C1 blocks only after strong B2 answers, C1 reading only after both always-shown readings are right. Rules: `supabase/functions/_shared/welcomeTestFlow.ts`.
- New "Reading & Listening" section sits between Vocabulary and Communication; blocks are appended to the end of their section, existing questions are never reordered.
- Progress bar is by section (Section k of N) with a time estimate from per-section medians; there is no "x of 58" counter.
- Level for bank 2 is a CEFR ladder (2+ items per level, 60% to pass, borders counted at the lower level); bank 1 keeps the mean-percent level.
- Retakes alternate Form A/B (`formForAttempt`). Switch-on: set `CURRENT_WELCOME_BANK = 2` after generating audio for wt_q71/wt_q72 (A and B) and filling `audio_url`.
