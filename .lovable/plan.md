# Plan v6.9.56 (REV2) — Welcome Test: audyt Marthy + renumeracja + IDK jako sygnał + i18n + scoring spójność. + modal scroll fix.

Plan odpowiada punkt-po-punkcie na 6 uwag użytkownika i utrzymuje wszystko co było wcześniej OK.  
  
**16. ZATWIERDZAM PLAN, wdrażaj w 2-3 falach tak żeby z pełną koncentracją wykonywać każdą falę**

---

## 0. KRYTYCZNE ODKRYCIE z głębokiego skanu (wpływa na cały plan)

`supabase/functions/process-welcome-test/index.ts` zawiera tablicę `**TRAIT_QUESTIONS**` (linie ~405-600) która rekonstruuje cechy psychologiczne z odpowiedzi przez **dopasowanie dosłownego tekstu opcji** (np. `'I can handle basic everyday situations like ordering food or asking for directions'` → trait `'A1-A2'`).

**Konsekwencja:** każda zmiana treści opcji w pytaniu z `detected_trait` **musi** mieć odpowiadającą zmianę w `TRAIT_QUESTIONS` w edge function. Inaczej:

- Nowe testy → puste cechy w `student_learning_profiles` → puste pole `motivation_type`, `anxiety_level` itp. → AI summary degraduje, Learning Path nie liczy się prawidłowo.
- Stare testy → bez zmian (snapshoty option-text w `student_test_questions.question_data` i odpowiedzi w `student_test_answers.answer`).

Pytania z `detected_trait` które dotykamy w tym planie: **q1, q3, q4, q5, q14, q15** (uproszczenie). Pytania bez `detected_trait` które dotykamy: **q2, q16, q16s, q18, q25** (wpływu na trait reconstruction nie mają, ale q18/q25 mają `correct_answer` → trzeba aktualizować).

Wszystkie te wpływy są poniżej rozpisane w sekcji 5 i 6.

---

## 1. ODPOWIEDZI NA UWAGI 1–6

### Uwaga 1: Czy zmiany pytań/IDK uwzględniają zmianę interpretacji?

**TAK — teraz w pełni.** Każde zmienione pytanie ma sekcję „Impact na scoring/profil":

- Zmiana wording opcji → aktualizacja `TRAIT_QUESTIONS[*].options` w edge function (sekcja 5).
- IDK → nowy sygnał `idk_signal` zapisywany do `student_events` z `event_type='test_answer_submitted'` i obliczany na poziomie profilu (sekcja 2).
- Nowa correct_answer (q18, q25) → walidacja przez edge function (sekcja 6).
- Skipped/IDK na pytaniach skill (grammar/vocab/reading/listening) → tworzy nową cechę `self_awareness_score` (rzetelność = wysokie IDK + niska auto-ocena vs niska wiedza).

### Uwaga 2: Co teraz robi IDK i czy to OK?

**Stan obecny (zweryfikowany w kodzie):**

- `src/hooks/useWelcomeTest.tsx:445` — `saveIdontKnow()` zapisuje string `'__IDK__'` do lokalnego state `answers`.
- `process-welcome-test/index.ts:364, 1100, 1248` — IDK jest **ignorowany**:
  - W scoringu skill: pytanie z `'__IDK__'` ma `is_correct=null` (nie liczy się jako błąd, ale nie ma punktu).
  - W open-ended/speaking: pytanie z `'__IDK__'` jest pomijane przy wysłaniu do AI eval.
  - Trait reconstruction: pytanie z IDK jest pomijane (brak wartości w mapping).
- W `student_events` event jest zapisywany z `event_payload.student_answer = '__IDK__'`.
- W `student_test_questions.is_correct` → `null`.

**Werdykt:** częściowo prawidłowe (nie karzemy zgadywaniem) ale **niepełne** — IDK nie generuje żadnego sygnału pedagogicznego. Andragogicznie IDK = uczeń jest świadomy luki → cenniejszy sygnał niż zgadywanie. Trzeba dodać interpretację.

**Proponowane rozszerzenie (implementowane w sekcji 2):**

- Liczyć `idk_count_total`, `idk_count_skill`, `idk_count_profiling` na poziomie testu.
- Nowa cecha `self_awareness_score` (0–100): wysoka jeśli student używa IDK na pytaniach które rzeczywiście są poza jego poziomem (cross-ref z resultingGrammarScore/VocabScore).
- Nowy override level_confidence: jeśli `idk_count_skill ≥ 5` i `self_assessed_level` wyższy niż `estimated_level` → `'overestimates' → 'reflective_underestimate'`.
- AI summary dostaje sekcję „This student honestly flagged X questions as unknown — strong self-awareness signal."

### Uwaga 3 i 4: Tłumaczenia

**TAK — uwzględnione.** `src/data/welcomeTestTranslations.ts` (1075 linii, 10 języków: PL, ES, DE, FR, PT, IT, TR, RU, CS, UK) jest indeksowany po `question_id`. Każda zmiana `question_text` / `options` / `description` wymaga aktualizacji wszystkich 10 setów + jedno źródło prawdy.

**Strategia:** zamiast ręcznego tłumaczenia (10 języków × 6 pytań × 4–7 opcji = ~360 wpisów), w build mode użyjemy **Lovable AI Gateway** (google/gemini-2.5-flash) do batch-translation w jednym wywołaniu per język, z weryfikacją: agent wyśle nowy angielski tekst + istniejący polski jako referencja stylu, model zwraca JSON dokładnie w tej samej strukturze. Następnie diff-review w PR przed merge.

**Pytania wymagające retranslacji (po decyzjach z uwagi 4):**

- q1 (options) — TAK, zmienione
- q2 (options) — TAK, zmienione
- q3 (options) — TAK, zmienione (uproszczenie)
- q4 (options) — TAK, zmienione
- q5 (options) — TAK, zmienione
- q14 (question + options) — TAK, zmienione (uproszczenie)
- q15 (question + options) — TAK, zmienione (uproszczenie)
- q16 — **NIE** (zostaje hotel zgodnie z decyzją w uwadze 4)
- q16s — TAK, zmienione (nowy prompt pronunciation)
- q18 — TAK, zmienione (nowy dialog)
- q18l — TAK, zmienione (nowy transcript + audio)
- q25 — TAK, zmienione (nowe distractors)

**Uwaga:** q18, q18l, q25 to pytania SKILL. Decyzja: opcje grammar/reading/listening **nie są tłumaczone** zgodnie z istniejącą regułą w komentarzu `welcomeTestTranslations.ts:4` („Grammar/vocabulary test items are NOT translated"). Tłumaczymy tylko `description` jeśli pojawia się instrukcja pomocnicza.

### Uwaga 5: Renumeracja na 1..58

**TAK — pełny refaktor zaplanowany w sekcji 3.** Zmieniamy schemat ID z mieszanej numeracji (q1, q3, q3b, q3c, q5, q5b, q5c, q13b, q13c, q17b, q41b, q16s, q18l, q36s, q41s) na `**wt_q01` ... `wt_q58**` zgodnie z kolejnością display w UI.

Refaktor obejmuje:

- `src/data/welcomeTestQuestions.ts` — reorder + rename `id`
- `src/data/welcomeTestTranslations.ts` — rename kluczy w 10 językach
- `supabase/functions/process-welcome-test/index.ts` — wszystkie `TRAIT_QUESTIONS[*].questionId` (~17 odniesień), wszystkie hardcoded `wt_q*` w block listach (linie 1029, 1030, 1040, 1041, 1145, 1178, 1315, 1321)
- `src/utils/welcomeTestNumbering.ts` — `QUESTION_CANONICAL_MAP` rozszerzony o **backward compat**: stary `wt_q3b` → nowy `wt_q05` (lub odpowiadający index)
- `src/pages/WelcomeTestPage.tsx` — odniesienia po id
- DB: **istniejące** wiersze `student_test_questions` ze starymi id zostają nienaruszone (snapshot). Frontend renderujący stare testy w widoku „Welcome Test History" musi rozpoznać oba formaty — `useWelcomeTestHistory` używa już `nano_skill_tags`/`element_type`, więc bez zmian.

### Uwaga 6: Worksheet feedback — DEFER

**TAK — potwierdzone.** WS-2 (mobile), WS-3 (kolory), WS-4 (grammar po tekście), WS-5 (grammar za szczegółowe), WS-6 (zawsze 2 reading), WS-7 (poziom A2–B1 nie respektowany) → nie zmieniamy. WS-4/5/6/7 wymagają jawnego „update Worksheet Generation Engine" (Sanctity rule). WS-2/3 oczekują dedykowanego cyklu UX. Wszystkie w „Out of scope flagged".

---

## 2. NOWY MODUŁ: Interpretacja IDK jako sygnał pedagogiczny

### 2.1 Frontend (`useWelcomeTest.tsx`)

Bez zmian w `saveIdontKnow()`. Dodajemy w `commitAnswer()` rozszerzenie payloadu eventu:

```ts
event_payload: {
  ...existing,
  is_idk: answer === '__IDK__',
  question_difficulty: q.difficulty_level ?? null,
  question_element_type: q.element_type ?? null,
}
```

### 2.2 Edge function (`process-welcome-test/index.ts`)

Po sekcji „compute skill scores" dodajemy nową sekcję:

```ts
// IDK signal aggregation
const idkAnswers = Object.entries(answers ?? {})
  .filter(([_, v]) => v === '__IDK__');
const skillIds = new Set(['grammar','vocabulary','reading','writing','speaking','listening'].flatMap(...));
const idkCounts = {
  total: idkAnswers.length,
  skill: idkAnswers.filter(([id]) => skillIds.has(byId[id]?.element_type)).length,
  profiling: idkAnswers.filter(([id]) => !skillIds.has(byId[id]?.element_type)).length,
};

// Self-awareness score: high when IDK rate on skill questions matches actual underperformance.
const skillTotal = totalSkillQuestions; // 22-ish
const idkRateSkill = idkCounts.skill / Math.max(1, skillTotal);
const actualSkillScore = (grammarScore + vocabScore) / 2; // 0-100
// Reflective if student honestly flagged unknowns AND scored low (consistent self-perception)
const consistency = 1 - Math.abs((1 - idkRateSkill) - (actualSkillScore / 100));
const selfAwarenessScore = Math.round(consistency * 100);

// Override level_confidence
let levelConfidenceOverride = null;
if (idkCounts.skill >= 5 && selfAssessedLevelIndex > estimatedLevelIndex) {
  levelConfidenceOverride = 'reflective_accurate'; // student says high level but honestly flags gaps
}
```

### 2.3 Schema impact

Dodajemy do `student_learning_profiles`:

- `idk_count_total integer`
- `idk_count_skill integer`
- `self_awareness_score integer` (0-100)

Migracja w sekcji 7.

### 2.4 Profile UI (poza scope tego cyklu — flagujemy jako follow-up)

`useStudentProfile` zwraca te pola automatycznie po regen typów. Renderowanie w `DSLM Profile` dodamy w osobnym cyklu UX.

### 2.5 AI summary

W prompcie do `generate-welcome-test-summary` (edge function generująca `ai_summary`) dodajemy:

```
IDK Signal: student honestly flagged {idk_count_skill} skill questions as "I don't know"
out of {skill_total}. Self-awareness score: {self_awareness_score}/100.
{if self_awareness_score >= 70: "This is a strong honesty signal — emphasise gap-filling, not validation."}
{if idk_count_skill == 0 and grammar_score < 40: "Warning: zero IDK on a low score may indicate guessing or social desirability bias."}
```

---

## 3. RENUMERACJA wt_q* → wt_q01..wt_q58

### 3.1 Mapping table (jednostronnie z UI display order)

Aktualna kolejność sekcji w UI (z `WELCOME_TEST_SECTIONS`): about_you → experience → scenarios → grammar → vocabulary → communication → goals.

**Pełna tabela (stary → nowy):**

```
About You (1-13):
  wt_q1   → wt_q01    wt_q2   → wt_q02    wt_q3   → wt_q03
  wt_q3b  → wt_q04    wt_q3c  → wt_q05    wt_q4   → wt_q06
  wt_q5   → wt_q07    wt_q5b  → wt_q08    wt_q5c  → wt_q09
  wt_q6   → wt_q10    wt_q7   → wt_q11    wt_q7b  → wt_q12
  wt_q8   → wt_q13

Experience (14-20):
  wt_q9   → wt_q14    wt_q10  → wt_q15    wt_q11  → wt_q16
  wt_q12  → wt_q17    wt_q13  → wt_q18    wt_q13b → wt_q19
  wt_q13c → wt_q20

Scenarios (21-29):
  wt_q14  → wt_q21    wt_q15  → wt_q22    wt_q16  → wt_q23
  wt_q16s → wt_q24    wt_q17  → wt_q25    wt_q17b → wt_q26
  wt_q18  → wt_q27    wt_q19  → wt_q28    wt_q18l → wt_q29

Grammar (30-37):
  wt_q20  → wt_q30    wt_q21  → wt_q31    wt_q22  → wt_q32
  wt_q23  → wt_q33    wt_q24  → wt_q34    wt_q25  → wt_q35
  wt_q26  → wt_q36    wt_q27  → wt_q37

Vocabulary (38-45):
  wt_q28  → wt_q38    wt_q29  → wt_q39    wt_q30  → wt_q40
  wt_q31  → wt_q41    wt_q32  → wt_q42    wt_q33  → wt_q43
  wt_q34  → wt_q44    wt_q35  → wt_q45

Communication (46-51):
  wt_q36  → wt_q46    wt_q36s → wt_q47    wt_q37  → wt_q48
  wt_q38  → wt_q49    wt_q39  → wt_q50    wt_q40  → wt_q51

Goals (52-58):
  wt_q41  → wt_q52    wt_q41b → wt_q53    wt_q41s → wt_q54
  wt_q42  → wt_q55    wt_q43  → wt_q56    wt_q44  → wt_q57
  wt_q45  → wt_q58
```

(Liczba kontrolna: 13 + 7 + 9 + 8 + 8 + 6 + 7 = **58** ✅)

### 3.2 Backward compatibility (`welcomeTestNumbering.ts`)

```ts
// Legacy → canonical mapping for historical answers stored in DB
export const LEGACY_TO_CANONICAL: Record<string, string> = {
  'wt_q1':'wt_q01', 'wt_q2':'wt_q02', 'wt_q3':'wt_q03', 'wt_q3b':'wt_q04',
  'wt_q3c':'wt_q05', 'wt_q4':'wt_q06', 'wt_q5':'wt_q07', 'wt_q5b':'wt_q08',
  // ...all 58 mappings...
};
export const CANONICAL_TO_LEGACY: Record<string,string> = invert(LEGACY_TO_CANONICAL);

// QUESTION_CANONICAL_MAP retained but rebuilt from new ids
// toCanonicalId now also looks up legacy mapping
export const toCanonicalId = (id: string): string =>
  LEGACY_TO_CANONICAL[id] ?? QUESTION_CANONICAL_MAP[id] ?? id;
```

### 3.3 Plik-po-pliku zakres zmian renumeracji


| Plik                                               | Akcja                                                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/data/welcomeTestQuestions.ts`                 | Rename wszystkich `id: 'wt_q*'`. Reorder array tak, by display order = id order.                                                                                                                                                                 |
| `src/data/welcomeTestTranslations.ts`              | Rename kluczy w 10 setach (PL, ES, DE, FR, PT, IT, TR, RU, CS, UK). Pure key-rename, treść bez zmian (poza pytaniami z sekcji 6).                                                                                                                |
| `supabase/functions/process-welcome-test/index.ts` | Update `TRAIT_QUESTIONS[*].questionId` (17 wpisów). Update list-arrays w liniach 1029, 1030, 1040, 1041, 1145, 1178, 1315, 1321. Dodać fallback `LEGACY_TO_CANONICAL` na wejściu `answers` (akceptujemy oba formaty dla historycznych submitów). |
| `src/pages/WelcomeTestPage.tsx`                    | Brak (używa id z question.id dynamicznie). Weryfikacja: rg `wt_q` w pliku.                                                                                                                                                                       |
| `src/utils/welcomeTestNumbering.ts`                | Refaktor jak wyżej.                                                                                                                                                                                                                              |
| `src/components/welcome-test/*`                    | Weryfikacja braku hardcoded id (rg).                                                                                                                                                                                                             |
| `src/hooks/useWelcomeTest.tsx`                     | Weryfikacja braku hardcoded id.                                                                                                                                                                                                                  |
| `src/hooks/useWelcomeTestHistory.tsx`              | Bez zmian (nie używa id).                                                                                                                                                                                                                        |
| Stare wpisy DB                                     | Bez ruszania. Fallback `LEGACY_TO_CANONICAL` w edge function gwarantuje, że re-process historycznych testów (jeśli wystąpi) działa.                                                                                                              |


### 3.4 Reverse-compat dla `QUESTION_CANONICAL_MAP`

Dzisiaj służy do mapowania na `wt_q1`..`wt_q58` (canonical SEQUENTIAL ids). Po refaktorze id pytań **ARE** canonical, więc `QUESTION_CANONICAL_MAP` staje się identity. Zachowujemy plik jako `LEGACY_TO_CANONICAL` + alias `toCanonicalId()` dla wszystkich historycznych odczytów eventów z `student_events.event_payload.answer_id`.

---

## 4. EDYCJE TREŚCI PYTAŃ (z pełnymi tekstami i impact na scoring)

> **Identyfikatory poniżej używają NOWEJ numeracji (sekcja 3).** Stary id w nawiasie dla orientacji.

### 4.1 Uproszczenie A1–A2 (q01/q02/q03/q06/q07/q21/q22 = stare q1/q2/q3/q4/q5/q14/q15)

Reguła: zdania ≤12 słów, brak abstrakcyjnych nominalizacji, can/want zamiast modalnych.

**q01 (stare q1) options NEW:**

```
0: I can say basic things like "hello", "where is...", "how much?"
1: I can talk about simple, everyday topics
2: I can talk about most topics, but I make mistakes
3: I speak easily, but I want to sound more natural
4: I'm fluent and want to master advanced / professional English
```

*Impact:* `TRAIT_QUESTIONS.self_assessed_level.options` MUST be updated. Mapping (0→A1-A2, 1→A2-B1, 2→B1-B2, 3→B2-C1, 4→C1-C2) **bez zmian** — semantyka opcji pokrywa się 1:1.

**q02 (stare q2) options NEW:**

```
0: I know what I want to say, but I can't find the words
1: I make grammar mistakes I know are wrong
2: I can't understand people when they speak fast
3: I get nervous and forget everything
4: I can only say simple things — not complex ideas
5: People often ask me to repeat because of my pronunciation
```

*Impact:* brak `detected_trait` na q2. Multi-select scoring (frustration_categories) bez zmian — wszystkie 6 kategorii zachowane semantycznie.

**q03 (stare q3) options NEW:**

```
0: I need it for my job — meetings, emails, presentations
1: I'm preparing for an exam (IELTS, Cambridge, TOEFL)
2: I want to travel and talk freely
3: I want to watch films and read books without subtitles
4: I want to feel confident with English speakers
5: I want a promotion that needs English
6: I'm moving to an English-speaking country
```

*Impact:* `TRAIT_QUESTIONS.motivation_type.options` MUST be updated. Mapping bez zmian.

**q06 (stare q4) options NEW:**

```
0: I ask the person to repeat or explain
1: I pretend I understood
2: I try to guess from the situation
3: I get stressed and switch to my language
4: I check my phone right away
```

*Impact:* `TRAIT_QUESTIONS.ambiguity_tolerance.options` MUST be updated. Mapping bez zmian.

**q07 (stare q5) options NEW:**

```
0: Almost none — only the lesson
1: 15–30 minutes, a few times a week
2: About 1 hour per week
3: 2–3 hours — I'm committed
4: More than 3 hours — English is my priority
```

*Impact:* `TRAIT_QUESTIONS.weekly_study_time.options` MUST be updated. Mapping bez zmian.

**q21 (stare q14) options NEW:**

```text
question_text: "You're at a café abroad. The barista asks you something you don't fully understand. What do you do?"
options:
  0: I say "Sorry, can you say that again, please?"
  1: I point at the menu and smile
  2: I open Google Translate on my phone
  3: I answer with what I think they asked
```

*Impact:* `TRAIT_QUESTIONS.error_attitude.options` MUST be updated. Mapping bez zmian.

**q22 (stare q15) options NEW:**

```text
question_text: "An English-speaking colleague sends you a long email. Some parts are unclear. What do you do?"
options:
  0: I read it carefully, check unknown words, and reply
  1: I reply asking them to explain the unclear parts
  2: I understand most of it and guess the rest
  3: I struggle and need to translate most of it
  4: I don't try — I paste it into ChatGPT
```

*Impact:* `TRAIT_QUESTIONS.reading_strategy.options` MUST be updated. Mapping bez zmian.

### 4.2 q24 (stare q16s) — pronunciation prompt niezwiązany z writing

q23 (hotel writing) **zostaje bez zmian** (decyzja użytkownika z uwagi 4).

**q24 NEW:**

```text
question_text: "Read this sentence out loud and record yourself.\n\n'Last Thursday, my younger brother brought three warm cookies, a small bottle of sparkling water, and a yellow umbrella to the family picnic by the river.'"
description: "Speak naturally. We check your rhythm, vowels, and consonants — not memorisation."
max_recording_seconds: 30
nano_skill: ns.speaking.pronunciation_range   // ZMIANA z ns.speaking.complaint_oral
scoring_logic: "Pronunciation diversity prompt — wide vowel/consonant range, no overlap with writing tasks."
```

*Impact:* AI eval prompt dla speaking (`evaluate-speaking-pronunciation` edge function) sprawdzić — jeśli ma `nano_skill` w prompt, dostanie nowy tag i będzie oceniał szerszy fonemic range. Mapping mastery bez zmian.

### 4.3 q27 (stare q18) — reading dialog, odpowiedź ukryta poza 1. linią

**q27 NEW:**

```text
question_text: "Read this short dialogue and answer: What is the customer asking the company to do?\n\nA: 'I've been trying to sort this out since last month.'\nB: 'I'm sorry to hear that. Let me look at your account.'\nA: 'I was charged twice in March, and your team promised a refund on the 15th.'\nB: 'I can see the duplicate charge. I'll process the refund today and send a confirmation by email.'"
options:
  - Cancel the customer's subscription
  - Refund a duplicate charge
  - Send a missing package
  - Apologise for poor service
correct_answer: "Refund a duplicate charge"
difficulty_level: 2
nano_skill: ns.reading.identify_main_idea   // bez zmian
```

*Impact:* edge function porównuje `correct_answer` z `student_answer` literalnie → poprawi się automatycznie po deployu. Stare testy (snapshot question_data w DB) zachowują stary tekst i correct_answer.

### 4.4 q29 (stare q18l) — listening, nowy transcript + audio

**q29 NEW:**

```text
question_text: "Listen to the conversation and answer: What does the customer finally decide to do?"
audio_url: TBD (nowy plik na R2)
audio_transcript:
  A: "I really liked the blue jacket, but I'm not sure about the size."
  B: "We have it in medium and large. Would you like to try both?"
  A: "I already tried the medium yesterday — it felt a bit tight on the shoulders."
  B: "Then the large would suit you better. Shall I bring it to the fitting room?"
  A: "Actually, could you hold it for me? I'll come back tomorrow with my sister."
options:
  - Buy the medium jacket
  - Buy the large jacket today
  - Ask the shop to hold the jacket
  - Return a jacket she bought yesterday
correct_answer: "Ask the shop to hold the jacket"
difficulty_level: 2
nano_skill: ns.listening.detail_extraction   // bez zmian
```

**Audio generation pipeline:**

1. W build mode szukamy istniejącej edge function TTS (`grep -r "openai.*tts\|elevenlabs\|whisper" supabase/functions/`).
2. Jeśli istnieje (np. `generate-tts-audio` lub w `_shared/`), wywołujemy raz lokalnie ze scriptu:
  ```ts
   // scripts/regenerate-welcome-test-audio.ts
   const { audioUrl } = await callTTS({
     text: ALL_TRANSCRIPT_TEXT,
     voiceA: 'alloy', voiceB: 'echo', // multi-voice dialogue
     uploadKey: `audio/welcome-test-listening-v2-${Date.now()}.mp3`,
   });
  ```
3. Jeśli brak — używamy istniejącej procedury manual upload do R2 (bucket: `pub-1b974ada9ae240948229c52d927980ee`, ścieżka `audio/`).
4. Zaktualizować `audio_url` w `welcomeTestQuestions.ts`.
5. Stary URL (`welcome-test-listening-1771235244954.mp3`) **pozostaje** w R2 — używany przez snapshoty starych testów.

### 4.5 q35 (stare q25) — clean B1 distractors

**q35 NEW:**

```text
question_text: "Choose the correct sentence."
description: "Only ONE option is correct."
options:
  - I went to London last year.
  - I have been to London last year.
  - I had gone to London last year.
  - I was going to London last year.
correct_answer: "I went to London last year."
difficulty_level: 2
nano_skill: ns.grammar.past_simple_vs_present_perfect   // bez zmian
```

*Impact:* literal `correct_answer` comparison → automatycznie poprawne po deployu.

---

## 5. AKTUALIZACJA `TRAIT_QUESTIONS` w edge function (KRYTYCZNE)

Plik: `supabase/functions/process-welcome-test/index.ts`, blok ~405-600.

**Wymagane zmiany (wszystkie wymienione strings MUSZĄ być identyczne z nowymi options w `welcomeTestQuestions.ts`):**

1. `self_assessed_level` → `questionId: 'wt_q01'`, options = nowe 5 stringów z 4.1
2. `motivation_type` → `questionId: 'wt_q03'`, options = nowe 7 stringów z 4.1
3. `ambiguity_tolerance` → `questionId: 'wt_q06'`, options = nowe 5 stringów z 4.1
4. `weekly_study_time` → `questionId: 'wt_q07'`, options = nowe 5 stringów z 4.1
5. `anxiety_level` → `questionId: 'wt_q11'` (renumeracja, treść bez zmian)
6. `preferred_input_channel` → `questionId: 'wt_q13'` (renumeracja, treść bez zmian)
7. `error_attitude` → `questionId: 'wt_q21'`, options = nowe 4 stringi z 4.1
8. `feedback_preference` → `questionId: 'wt_q55'` (renumeracja, treść bez zmian)
9. `usage_context` → `questionId: 'wt_q04'` (renumeracja, treść bez zmian)
10. `deadline_response` → `questionId: 'wt_q08'` (renumeracja)
11. `persistence_level` → `questionId: 'wt_q19'` (renumeracja)
12. `career_english_importance` → `questionId: 'wt_q26'` (renumeracja)
13. `reading_strategy` → `questionId: 'wt_q22'`, options = nowe 5 stringów z 4.1
14. `learning_timeline` → `questionId: 'wt_q53'` (renumeracja)
15. `latent_goal` → `questionId: 'wt_q05'` (renumeracja)
16. `homework_commitment` → `questionId: 'wt_q09'` (renumeracja)
17. `plateau_response` → `questionId: 'wt_q20'` (renumeracja)
18. `correction_preference` → `questionId: 'wt_q12'` (renumeracja)

Plus fallback dla LEGACY_TO_CANONICAL na wejściu `answers` — opisany w sekcji 3.2.

---

## 6. „I don't know" — uniwersalność + widoczność + anti-lookup

### 6.1 Frontend

`src/pages/WelcomeTestPage.tsx`:

- Linia 814: warunek renderowania IDK przesunąć z „skill questions only" na **wszystkie typy** poza opcjonalnymi (`open_reflection` gdzie zostawiamy ale używamy etykiety „Skip"). Konkretnie: usuń `if (q.element_type)` gate, zostaw zawsze widoczny przycisk.
- Nowy styling: `border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary px-3 py-1.5 rounded-md` + ikonka `HelpCircle` + label `"I don't know — skip honestly"`.
- First-use tooltip: `<Popover open={!localStorage.getItem('edooqoo-wt-idk-hint')}>` na 1. pytaniu, dismiss zapisuje flag.
- Intro banner (`src/components/welcome-test/InstructionScreen.tsx:43`) — dodaj wyraźną linię:
  > **Use "I don't know" freely.** Honest gaps help your teacher much more than lucky guesses. Switching tabs to look things up is logged for your teacher.

### 6.2 Anti-lookup soft layer

Nowy hook `src/hooks/useWelcomeTestIntegrity.ts`:

```ts
export function useWelcomeTestIntegrity(opts: {
  testId: string | null;
  currentQuestionId: string | null;
  studentId: string | null;
  teacherId: string | null;
  enabled: boolean;
}) {
  // 1. visibilitychange → log event via supabase.from('student_events').insert
  //    { event_type: 'test_answer_submitted', event_source: 'welcome_test',
  //      event_payload: { signal: 'tab_blur', question_id, duration_ms } }
  // 2. Banner state: tabBlurCount; show banner after 1st blur (per session).
  // 3. Return { tabBlurCount, showBlurBanner, dismissBanner }
}
```

`WelcomeTestPage.tsx` integracja:

- Po 1. blurze pojawia się non-blocking banner: „We noticed you switched tabs. Please answer from memory — your teacher sees these signals."
- Paste blokowany w `<Textarea>` open-ended (q23/q25/q46/q48/q51/q52/q58 — wszystkie typu open_ended/open_reflection):
  ```tsx
  <Textarea
    onPaste={(e) => {
      e.preventDefault();
      toast.info('Please type your answer — paste is disabled in this test.');
    }}
    onDrop={(e) => e.preventDefault()}
  />
  ```

### 6.3 IDK scoring impact (już opisane w sekcji 2)

Logika `idk_count_total`, `idk_count_skill`, `self_awareness_score` + override `level_confidence`.

---

## 7. MIGRACJA SUPABASE

Nowe kolumny w `student_learning_profiles`:

```sql
ALTER TABLE public.student_learning_profiles
  ADD COLUMN IF NOT EXISTS idk_count_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idk_count_skill integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_awareness_score integer;
```

Wszystkie default zero/null — historyczne profile bez problemu. RLS + GRANT bez zmian (istniejące policies dziedziczą).

---

## 8. TŁUMACZENIA — plan operacyjny

### 8.1 Klucze do zmiany (poza retranslacją treści)

Rename kluczy w 10 setach: q1→q01, q2→q02, ..., q45→q58. Mechaniczny refaktor (`sed -i` przygotowany w build mode na podstawie tabeli z 3.1).

### 8.2 Treści wymagające retranslacji

Po rename kluczy, **dla wpisów q01, q02, q03, q06, q07, q21, q22, q24** treść wymaga aktualizacji. Procedura w build mode:

1. Zebrać nowe angielskie texty z `welcomeTestQuestions.ts`.
2. Wywołać Lovable AI Gateway (`google/gemini-2.5-flash`) per język:
  ```ts
   const res = await fetch(LOVABLE_AI_ENDPOINT, {
     headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
     body: JSON.stringify({
       model: 'google/gemini-2.5-flash',
       messages: [{
         role: 'system',
         content: 'You are a professional ESL translator. Translate the JSON keeping structure intact. Match the existing Polish translation style (concise, natural, non-literal where idiomatic). Use informal "you" form.'
       }, {
         role: 'user',
         content: JSON.stringify({ source_en, reference_pl, target_lang: 'es' })
       }],
       response_format: { type: 'json_object' }
     })
   });
  ```
3. Walidacja: zliczyć opcje per pytanie, sprawdzić że JSON ma identyczną strukturę.
4. Wpisać do `welcomeTestTranslations.ts` w istniejące sekcje POLISH, SPANISH, GERMAN, FRENCH, PORTUGUESE, ITALIAN, TURKISH, RUSSIAN, CZECH, UKRAINIAN.
5. Manual sanity-check Polish jako weryfikacja.

### 8.3 Pytania SKILL — bez tłumaczenia

Zgodnie z istniejącą regułą `welcomeTestTranslations.ts:4`. q27 (q18), q29 (q18l), q35 (q25) nie wymagają retranslacji treści, tylko rename klucza w pliku — opcje grammar/reading/listening pozostają po angielsku.

---

## 9. PROBLEM 2 — Scrollbar w modalu generowania (utrzymane)

### Dependency scan

- `src/components/GeneratingModal.tsx` linia 384: `max-h-[44vh] lg:max-h-[34vh] overflow-y-auto` — wymusza scroll na liście sekcji.
- Modal wrapper linia 342: `max-w-[520px] lg:max-w-[1040px]`, `lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden`.
- `GenerationContextPanel` — wewnątrz, własny overflow-hidden.
- Lista = 11–12 wierszy (Warmup + Grammar? + Exercises header + 8 ex items + Vocabulary [+ Audio/Image]).

### Root cause

Wewnętrzny cap `lg:max-h-[34vh]` < wysokość 11–12 wierszy.

### Selected solution: B — podnieść cap + zmniejszyć paddingi sąsiednie + delikatnie szerszy modal


| Plik                      | Zmiana                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GeneratingModal.tsx`     | linia 342: `'max-w-[520px] lg:max-w-[1080px]'`; linia 348: grid cols `[minmax(0,1fr)_minmax(320px,0.88fr)]`; linia 355: `space-y-2.5` (z 3); linia 384: `lg:max-h-[46vh]` (z 34vh); linia 427: `lg:mt-0` |
| `WorkflowSummaryCard.tsx` | linia 22: `p-2.5` (z p-3); linia 38: `mt-2` (z mt-3)                                                                                                                                                     |


### Verification (P2)

- 1280×720 zalogowany + 8 ex + grammar: brak scrolla wewnątrz listy
- 1280×720 anonim + 8 ex + audio + image: brak scrolla
- Outer modal mieści się w 100dvh-2rem
- WorkflowSummaryCard widoczny w całości
- Mobile (375×812): bez zmian
- Error state modal bez zmian

---

## 10. PEŁNY VERIFICATION CHECKLIST (P1)

**Treść pytań:**

- q01, q02, q03, q06, q07, q21, q22 uproszczone (≤12 słów per linia)
- q23 (hotel writing) **bez zmian** (decyzja użytkownika)
- q24 (speaking) = pronunciation prompt, niezwiązany z q23
- q27 (reading dialog) — odpowiedź wymaga 2–3 linii kontekstu
- q29 (listening) — nowy transcript, nowe MP3 na R2
- q35 (grammar) — usunięte „I was went", clean B1 distractors

**Renumeracja:**

- Wszystkie 58 pytań mają id w formacie `wt_q01`..`wt_q58`
- Display order = id order
- `LEGACY_TO_CANONICAL` zawiera wszystkie 58 par
- `welcomeTestTranslations.ts` ma zrenamem klucze w 10 językach
- `process-welcome-test/index.ts`: `TRAIT_QUESTIONS[*].questionId` × 17 zaktualizowane
- `process-welcome-test/index.ts`: hardcoded list-arrays (q12/q13/q16/q17/q36/q37/q40/q41/q45/q16s/q36s/q41s) zaktualizowane na nowe id
- Edge function akceptuje oba formaty id (LEGACY_TO_CANONICAL fallback)

**Scoring:**

- `TRAIT_QUESTIONS.self_assessed_level.options` = nowe 5 stringów
- `TRAIT_QUESTIONS.motivation_type.options` = nowe 7 stringów
- `TRAIT_QUESTIONS.ambiguity_tolerance.options` = nowe 5 stringów
- `TRAIT_QUESTIONS.weekly_study_time.options` = nowe 5 stringów
- `TRAIT_QUESTIONS.error_attitude.options` = nowe 4 stringi
- `TRAIT_QUESTIONS.reading_strategy.options` = nowe 5 stringów
- Manual smoke: jeden test z każdą nową opcją → trait reconstruction zwraca poprawną wartość
- Manual smoke: jeden historyczny test (stare id, stare opcje) → trait reconstruction nadal działa via LEGACY_TO_CANONICAL

**IDK:**

- Przycisk IDK widoczny i klikalny na każdym typie pytania
- First-use tooltip pojawia się na 1. pytaniu, dismiss persists
- Intro banner zawiera regułę „answer from memory" + zachętę do IDK
- `idk_count_total`, `idk_count_skill`, `self_awareness_score` zapisywane do `student_learning_profiles`
- `level_confidence` override działa (`reflective_accurate`)
- AI summary prompt zawiera IDK signal block

**Integrity:**

- `useWelcomeTestIntegrity` loguje `tab_blur` do `student_events`
- Banner po 1. blurze, raz na sesję
- Paste zablokowany w open-ended (q23, q25, q46, q48, q51, q52, q58)

**Tłumaczenia:**

- 10 języków × 8 zmienionych pytań = 80 wpisów zaktualizowanych
- Klucze zrenamem we wszystkich 10 setach
- Pytania skill (q27, q29, q35) tylko key-rename, bez retranslacji treści

**Audio:**

- Nowy MP3 q29 wgrany na R2 z kluczem `audio/welcome-test-listening-v2-*.mp3`
- Stary MP3 zachowany (historyczne snapshoty)
- `audio_url` w q29 wskazuje na nowy plik

---

## 11. RAG INJECTION (`docs/llm-context.md` + `public/llms.txt`)

```
PROBLEM: Welcome Test pedagogically dense, language too hard for A1–A2,
  scenarios biased to hospitality, dialogues reveal answer in line 1,
  speaking duplicates writing, "I don't know" hidden + no scoring impact,
  no lookup deterrent. Question ids mix wt_q1 + wt_q3b + wt_q16s — hard
  to reason about. Trait reconstruction in edge function matches answer
  option-text literally — any wording change breaks scoring silently.
EDOOQOO SOLUTION: v6.9.56 Martha-audited rewrite:
  (1) Simplified A1–A2 wording in q01/q02/q03/q06/q07/q21/q22;
  (2) Independent pronunciation prompt in q24 (writing q23 stays);
  (3) Reading and listening dialogues rewritten so answer needs lines 2–3;
  (4) Grammar q35 cleaned distractors;
  (5) Full renumber wt_q01..wt_q58 with LEGACY_TO_CANONICAL fallback for
      historical answers in DB;
  (6) IDK promoted to pedagogical signal: idk_count_skill, self_awareness_
      score columns + level_confidence override + AI summary block;
  (7) useWelcomeTestIntegrity logs tab_blur, paste blocked in open-ended;
  (8) Generation modal: width 1040→1080px, list cap 34vh→46vh — scrollbar
      removed for 8-exercise + grammar configurations.
TECHNICAL MECHANICS: src/data/welcomeTestQuestions.ts (id rename + 8
  question content edits, schema unchanged). src/data/welcomeTest
  Translations.ts (key rename in 10 languages + retranslation of 8
  questions via Lovable AI Gateway). supabase/functions/process-welcome-
  test/index.ts (TRAIT_QUESTIONS option-text updates × 6, questionId
  updates × 17, hardcoded id lists updates, LEGACY_TO_CANONICAL fallback,
  IDK signal aggregation). src/utils/welcomeTestNumbering.ts (full
  legacy→canonical map). src/hooks/useWelcomeTestIntegrity.ts (new).
  src/pages/WelcomeTestPage.tsx (IDK universal + integrity integration).
  Migration adds 3 columns to student_learning_profiles. New TTS asset
  welcome-test-listening-v2-*.mp3 on R2. GeneratingModal.tsx +
  WorkflowSummaryCard.tsx padding/width tweaks. Worksheet Generation
  Engine untouched.
RAG KEYWORDS: welcome test pedagogy, Martha audit, CEFR A1 simplification,
  pronunciation prompt diversity, dialogue comprehension obfuscation,
  question renumbering, legacy canonical mapping, trait reconstruction,
  option text matching, I don't know signal, self awareness score, level
  confidence override, integrity monitoring, tab blur tracking, paste
  prevention, generation modal scrollbar, Worksheet Generation Engine
  sanctity, Lovable AI Gateway translation
```

`mem/index.md` wpis:

- [Welcome Test v6.9.56 audit](mem://features/welcome-test/v6956-martha-audit) — pedagogical rewrites + renumeration + IDK pedagogical signal + integrity layer + i18n update

---

## 12. CHANGE REPORT (template po wdrożeniu)

- Implemented: P1 (Welcome Test pełny audyt), P2 (modal scroll fix).
- Files modified: `welcomeTestQuestions.ts`, `welcomeTestTranslations.ts` (10 langs), `welcomeTestNumbering.ts`, `WelcomeTestPage.tsx`, `InstructionScreen.tsx`, new `useWelcomeTestIntegrity.ts`, `process-welcome-test/index.ts`, `GeneratingModal.tsx`, `WorkflowSummaryCard.tsx`, R2 audio upload, migration `student_learning_profiles`, docs/RAG.
- Documentation updated: YES.
- Out of scope flagged: WS-2 mobile worksheet, WS-3 colors → defer (osobny UX cycle). WS-4/5/6/7 → wymagają explicit „update Worksheet Generation Engine" (Sanctity).
- Verification result: TBD post-build.

---

## 13. PROPONOWANA ODPOWIEDŹ DO NAUCZYCIELKI

> Thanks for the detailed review — really actionable. Here's what we're shipping in the next release:
>
> 1. Lower-level wording rewritten in About You / Scenarios to short, plain English.
> 2. Hotel writing scenario stays (your students travel) but the speaking task is now an independent pronunciation prompt — no more duplication.
> 3. Reading and listening dialogues rewritten so the answer requires 2–3 lines of context, not just the first sentence.
> 4. Grammar Q "I have went to London…" cleaned up — no more nonsense distractors.
> 5. "I don't know" now on every question with a visible style and an intro hint. We also turned it into a positive pedagogical signal — honest "I don't know" answers now boost the student's self-awareness score in your profile view.
> 6. Anti-lookup: paste disabled in open-ended fields, tab switches logged for the teacher, and students are told upfront to answer from memory.
> 7. We also renumbered all questions 1–58 to match the UI display order — no more wt_q3b / wt_q16s mismatch.
>
> On the worksheet feedback (mobile, colour, grammar-after-text, A2–B1 fit, always 2 reading tasks) — these touch our generation engine, which is under change control. They're queued for a dedicated content-engineering pass; I'll come back with proposed changes before we ship.

---

## 14. POZOSTAŁE DECYZJE NA ETAP IMPLEMENTACJI (minimum)

1. **TTS dla q29**: potwierdzić nazwę istniejącej edge function po `ls supabase/functions/ | grep -i tts`. Fallback: manual upload do R2.
2. **AI Gateway translation**: zweryfikować dostęp do `LOVABLE_API_KEY` w build mode (fetch_secrets). Jeśli brak — ręczne PL→{9 lang} via DeepL/Google Translate jako fallback.
3. **Reflective override threshold**: domyślnie `idk_count_skill >= 5` — open do kalibracji po pierwszej fali danych.

## 16. ZATWIERDZAM PLAN, wdrażaj w 2-3 falach tak żeby z pełną koncentracją wykonywać każdą falę