## Plan v6.9.15a — naprawa Next Steps + przywrócenie generateWorksheet

Cel: rozwiązać 4 błędy z bieżącego ekranu Pathway/Next Steps oraz dać Ci dokładną instrukcję przywrócenia promptu `generateWorksheet` do repo. Zero zmian w działającym promptcie worksheet (Sanctity), zmiany w `generate-timeline` ograniczone do mechaniki (token budget, walidacja, lepsze błędy) — bez przepisywania wordingu.

---

### Problem 1 — `generate-timeline` zwraca 500 dla `count > 1` przy phase target

**Diagnoza (potwierdzona w kodzie):**

- `supabase/functions/generate-timeline/index.ts` linia 245 ma `max_tokens: 3500` na sztywno.
- Jedna sugestia = ~800–1100 tokenów (8 exercises + focus map + rationale + estimatedImpact + grammar). Tool-calling Gemini 2.5 Flash dolicza tokeny rozumowania.
- Dla `count=1` mieści się; dla `count≥2` model trafia w `finish_reason: "length"` → tool call jest niekompletny → `JSON.parse` rzuca → catch ustawia `suggestions = []` → po sanityzacji 0 sugestii. Ale `throw` na tool error nie ma — więc skąd 500? 500 leci, gdy `aiResponse.ok === false` (przekroczenie limitu tokenów wyjściowych po stronie gateway także zwraca błąd, a model przy `tool_choice: required` + obciętym output rzuca też 4xx/5xx). Druga przyczyna 500: timeout edge function przy `count=3` z dużym promptem.
- Ścieżka błędu w UI: `useFutureTimeline` linie 142–152 — gdy phase-bound 500, retry jako `next_steps` (też 500 z tej samej przyczyny) → toast „Generator returned an error".

**Edooqoo.com Solution (mechanika, bez ruszania wordingu promptu):**

A. **Dynamiczny `max_tokens**` w `generate-timeline/index.ts` linia 245:

```ts
max_tokens: Math.min(8192, 1800 + 2000 * count),
```

Dla `count=1` → 3800, `count=3` → 7800, `count=6` → 8192. Gemini 2.5 Flash dopuszcza do 8192 wyjściowych.

B. **Diagnostyka błędu** — zamiast `throw new Error('AI Gateway error: ...')` zwróć `502` z payloadem `{ error, status, finish_reason, raw_message_preview, count, mode }`. To pozwoli w przyszłości zobaczyć dokładną przyczynę bez polowania w logach.

C. **Wykrycie obciętego tool-call** — po `JSON.parse` w bloku catch dodaj log `finish_reason` z `aiData.choices[0].finish_reason`. Jeśli `length`, zwróć dedykowany komunikat: `"AI output truncated — try lower count"`.

D. **Walidacja minItems przy braku sugestii** — jeśli po sanityzacji `suggestions.length < count`, zwróć `200` z tym co jest + ostrzeżenie w `generationContext.warning = "partial"` zamiast 500. Frontend już ma `slice(0, requestedCount)` (useFutureTimeline:158), więc partial OK.

E. **Frontend `useFutureTimeline**` (linie 141–153): gdy retry jako free step też failuje, pokaż konkretny toast `"AI generator overloaded — try generating 1 step at a time"` zamiast generycznego błędu.

**Świadomie pominięte:** zmiana modelu, asynchroniczne kolejki, `EdgeRuntime.waitUntil` (overkill — problem to tylko token budget). Wording promptu nietknięty.

---

### Problem 2 — pasek akcji w `NextStepBanner` łamie się do drugiej linii

**Diagnoza:** `src/components/dslm/NextStepBanner.tsx` linie 149–197. Sześć przycisków (`Generate worksheet ↗`, `Use this`, `Edit`, `Regenerate with comment`, `Mark as already used`, `Remove`) z pełnymi etykietami + ikona, w kontenerze `flex flex-wrap gap-2`. Przy szerokości karty ~860 px sumaryczna szerokość przekracza dostępne miejsce → `Remove` ląduje w drugim wierszu.

**Edooqoo.com Solution:** progresywne skracanie etykiet drugorzędnych akcji — primary CTA (`Generate worksheet ↗`) zostaje pełna, reszta przechodzi w warianty „icon + krótki label" z tooltipem zachowującym pełny opis.

Zmiany w `NextStepBanner.tsx` linie 149–197:

- Kontener: `flex flex-wrap gap-2 pt-1` → `flex flex-nowrap items-center gap-1.5 pt-1 overflow-x-auto` (na desktop powinno się zmieścić bez scrolla; mobile dostaje horizontal scroll zamiast łamania).
- `Use this` → `Use` (pozostaje ikona ClipboardCopy).
- `Regenerate with comment` → `Comment` (ikona MessageSquarePlus zostaje, tooltip „Regenerate with comment").
- `Mark as already used` → `Used` (ikona CheckCircle2, tooltip „Mark as already used").
- `Remove` → tylko ikona Trash2 z tooltipem `Remove` (size="icon", `h-8 w-8`).
- Wszystkie drugorzędne przyciski: `className="text-primary-foreground hover:bg-white/20 h-8 px-2 shrink-0"`.
- Owinąć każdy w `<Tooltip>` (już jest TooltipProvider w komponencie).

**Mobile fallback:** zachowane `flex-wrap` poniżej `sm`: dodać `sm:flex-nowrap`.

---

### Problem 3 — po usunięciu fazy modal sugeruje usuniętą fazę + numeracja nie przeskakuje

**Diagnoza A (stale phase w modalu):**

- `useCurriculumPhases.deletePhase` (linie 123–139) tylko ustawia `deleted_at` i robi `setPhases(prev => prev.filter(...))` — lista lokalnie się aktualizuje.
- `GenerateStepsDialog` dostaje `defaultTargetPhaseId` z parenta (`NextStepsSection` / `MacroTimeline`). To pole jest cache'owane (najpewniej w stanie sekcji i nie reagujące na zmianę `phases`).
- Po skasowaniu `defaultTargetPhaseId` wciąż wskazuje na usunięte UUID → useEffect linia 54–64 ustawia `phaseValue = defaultTargetPhaseId`. `phaseOptions.find()` zwraca undefined, ale Select pokazuje pustą wartość lub starą etykietę z poprzedniego renderu.

**Diagnoza B (numeracja):** `deletePhase` nie robi `UPDATE ... sequence_number = sequence_number - 1 WHERE sequence_number > deleted.sequence_number`. Pozostają luki (faza 1 usunięta → 2 i 3 zostają jako 2 i 3, nie spadają na 1 i 2).

**Edooqoo.com Solution:**

A. **Renumeracja sequence_number po delete** — w `useCurriculumPhases.tsx` linie 123–139:

```ts
const deletePhase = async (id: string): Promise<boolean> => {
  const phaseToDelete = phases.find(p => p.id === id);
  if (!phaseToDelete) return false;
  const deletedSeq = phaseToDelete.sequence_number;
  // Soft delete
  const { error } = await supabase.from('dslm_curriculum_phases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id).eq('teacher_id', teacherId);
  if (error) { /* toast + return false */ }
  // Renumber remaining (only NOT deleted, same student)
  const toShift = phases.filter(p => p.id !== id && p.sequence_number > deletedSeq);
  for (const p of toShift) {
    await supabase.from('dslm_curriculum_phases')
      .update({ sequence_number: p.sequence_number - 1 })
      .eq('id', p.id).eq('teacher_id', teacherId);
  }
  setPhases(prev => prev
    .filter(p => p.id !== id)
    .map(p => p.sequence_number > deletedSeq
      ? { ...p, sequence_number: p.sequence_number - 1 }
      : p
    ));
  toast.success('Phase removed');
  return true;
};
```

Bez migracji DB — tylko UPDATE-y (tabela już ma kolumnę). Jeśli liczba faz potrafi przekroczyć ~10, można w przyszłości zoptymalizować pojedynczym `RPC`, ale na razie sekwencyjne UPDATE wystarczy.

B. **Walidacja `defaultTargetPhaseId` w GenerateStepsDialog** — w `useEffect` linie 54–64:

```ts
useEffect(() => {
  if (!open) return;
  const validId = defaultTargetPhaseId && phaseOptions.some(p => p.id === defaultTargetPhaseId)
    ? defaultTargetPhaseId
    : null;
  const initialPhaseId = validId ?? FREE_VALUE;
  setPhaseValue(initialPhaseId);
  setCountTouched(false);
  const recPhase = phaseOptions.find(p => p.id === validId);
  const initialCount = recPhase
    ? Math.min(6, Math.max(1, recPhase.need - recPhase.have))
    : defaultCount;
  setCount(initialCount);
}, [open, defaultCount, defaultTargetPhaseId, phaseOptions]);
```

Dodatkowo zmienna `recommendedId` (linia 93) → `recommendedId = validId` (ten sam guard).

C. **Sortowanie i wyświetlanie** — `MacroTimeline` i `PathwayView` sortują już po `sequence_number ASC`, więc po renumeracji UI naturalnie pokaże 1, 2, 3.

**Świadomie pominięte:** twarde unique-constraint na `(student_id, sequence_number)` — dodawałoby ryzyko race conditions przy równoległych zapisach. Soft delete + sekwencyjny UPDATE wystarczy.

---

### Problem 4 — info-boxy w sekcji wyboru studenta na formularzu

**Diagnoza:** `src/components/WorksheetForm/index.tsx` linie 654–705. Trzy ścieżki wyboru studenta. Brakuje informacji kontekstowej dla:

- (a) zalogowany, ma studentów, ale wybrał `no-student` — jest tylko 1-linijkowy tekst pod selectem.
- (b) zalogowany, ma studentów, wybrał konkretnego, ale ten student nie ma żadnych Next Steps — brak komunikatu (NextStepsPresetBanner po prostu się nie renderuje).
- (c) zalogowany bez studentów — jest CTA `Add your first student`, ale bez wyjaśnienia *dlaczego* warto.

**Edooqoo.com Solution:** Dodać uniwersalny komponent `<StudentContextHint variant="..." />` renderowany pod selectem (dla a/b) lub pod CTA (dla c). Jeden plik: `src/components/WorksheetForm/StudentContextHint.tsx`.

Warianty i copy (EN — zgodnie z regułą „aplikacja po angielsku"):


| Wariant         | Warunek                                                                | Tekst                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-students`   | `userId && students.length === 0`                                      | „Worksheets without a student are generic. Add your first student to unlock personalized goals, level matching, and AI Next Steps."                              |
| `no-selection`  | `userId && students.length > 0 && selectedStudentId === 'no-student'`  | „You have students but none is selected. Pick one above to personalize the worksheet to their level, goals, and pacing."                                         |
| `no-next-steps` | `userId && selectedStudentId !== 'no-student' && nextStepsCount === 0` | „This student has no Next Steps yet. Open their Pathway to generate AI-recommended next worksheets, or continue with manual setup below." + link `/student/{id}` |


**Style:** karty w stylu `Card` z `border-amber-300 bg-amber-50/30 dark:bg-amber-950/20 text-xs px-3 py-2 rounded-md` z ikoną `Info` (lucide). Dla `no-next-steps` ikona `Sparkles` + przycisk-link `Open Pathway →`.

**Źródło `nextStepsCount`:**

- Najprościej: dodać krótki hook `useStudentNextStepsCount(studentId)` → `select count(id) from future_worksheet_suggestions where student_id=? and is_used=false and deleted_at is null` (limit 1 wystarcza do flagi 0/>0).
- Alternatywa: re-use `useFutureTimeline` (cięższe). Zalecam dedykowany lekki hook żeby nie ładować całej historii.

**Miejsce wstawienia w `WorksheetForm/index.tsx`:**

- Pod blokiem 655–705 (poza wewnętrznym `<div w-[23%]>`) wstawić cały rząd `<div className="w-full mt-2">{hint}</div>` zanim zaczną się kolejne karty (Exercise Types itd.). Hint pojawia się tylko gdy któryś warunek jest spełniony.

---

### Problem 5 — przywrócenie `generateWorksheet` do repo

**Stan obecny:**

- Twoje archiwum z PowerShell (63 funkcje) **nie zawiera** `generateWorksheet`, bo nie było jej na liście. W repo tej funkcji wciąż brakuje.
- W produkcji Supabase `generateWorksheet` ma 627 deploymentów, datowana „a year ago / 12 days ago" — istnieje i działa.
- Sanctity Rule zabrania mi modyfikować wording promptu — ale samo *przywrócenie pliku 1:1* z produkcji nie jest modyfikacją (to bit-perfect copy z prawdziwego runtime).

**Co zrobić — krok po kroku po Twojej stronie:**

1. W PowerShell w katalogu projektu uruchom:
  ```powershell
   supabase functions download generateWorksheet
  ```
2. CLI utworzy `supabase/functions/generateWorksheet/index.ts` (ewentualnie z plikami pomocniczymi w tym katalogu, jeśli funkcja je ma).
3. Sprawdź czy poza `index.ts` są jakieś inne pliki w `supabase/functions/generateWorksheet/`. Jeśli tak — zachowaj je.
4. Spakuj cały folder `supabase/functions/generateWorksheet/` (z całą zawartością) do `generateWorksheet.zip` i wrzuć mi. ściągnąłem i wrzucam generateWorksheet.rar
5. Ja:
  - rozpakuję,
  - skopiuję 1:1 do `supabase/functions/generateWorksheet/`,
  - **nie zmienię ani jednej linii promptu** (zgodnie z Sanctity Rule),
  - zrobię tylko spot-check że `index.ts` zaczyna się od `Deno.serve`/`serve`/`import` i ma poprawne CORS,
  - po deploy potwierdzę że istniejące wywołania `generateWorksheet` z frontu (`worksheetService/apiService.ts`, `exerciseRegenerationService.ts` linia 6) wciąż działają (no-op funkcjonalne — kod = produkcja).

**Co NIE zostanie zrobione w tej iteracji:**

- Żadne edycje promptu generowania worksheet.
- Żadne governance / 4-warstwowa polityka Sanctity (osobna iteracja v6.9.15b).
- Żadne audyty A/B/C (osobna iteracja v6.9.15c).

---

### Mapa zmian w plikach


| Plik                                                  | Zmiana                                                                                | Problem |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ------- |
| `supabase/functions/generate-timeline/index.ts`       | dynamic `max_tokens`, lepsze błędy (502 + finish_reason), partial-success zamiast 500 | 1       |
| `src/hooks/useFutureTimeline.tsx`                     | lepszy toast po retry-fail                                                            | 1       |
| `src/components/dslm/NextStepBanner.tsx`              | refaktor paska akcji (skrót etykiet, nowrap, tooltips, Remove jako icon-only)         | 2       |
| `src/hooks/dslm/useCurriculumPhases.tsx`              | renumeracja `sequence_number` po `deletePhase`                                        | 3       |
| `src/components/dslm/GenerateStepsDialog.tsx`         | walidacja `defaultTargetPhaseId` względem `phaseOptions`                              | 3       |
| `src/components/WorksheetForm/StudentContextHint.tsx` | NOWY komponent z 3 wariantami                                                         | 4       |
| `src/components/WorksheetForm/index.tsx`              | wstawienie `<StudentContextHint>` pod sekcją wyboru studenta                          | 4       |
| `src/hooks/useStudentNextStepsCount.ts`               | NOWY lekki hook (count 0 / >0)                                                        | 4       |
| `supabase/functions/generateWorksheet/...`            | bit-perfect copy z produkcji (po Twoim ZIP-ie)                                        | 5       |
| `docs/llm-context.md` + `llms.txt`                    | wpis v6.9.15a (Problem → Solution → Mechanics + RAG keywords)                         | RAG     |


---

### Kolejność wdrożenia (po Twojej akceptacji)

1. Problem 3 (renumeracja + walidacja modalu) — najszybciej, izolowane.
2. Problem 2 (pasek akcji) — pure UI, zero ryzyka.
3. Problem 4 (info-boxy + hook) — nowe pliki, brak wpływu na istniejące.
4. Problem 1 (edge function `max_tokens` + diagnostyka) — wymaga deploy i obserwacji 1–2 generacji.
5. Update `docs/llm-context.md` + `llms.txt`.
6. Problem 5 — czekam na Twój ZIP z `generateWorksheet`, potem osobny copy + deploy.

Czas wykonania 1–5: ~15–20 min implementacji + auto-deploy edge function. Problem 5 osobno po ZIP-ie.

---

### Ryzyka i mitygacje

- **Renumeracja faz, race condition:** jeśli dwie osoby usuwają fazy równocześnie, sequence może się nakładać. Mitygacja: dla MVP akceptowalne (1-on-1 tutoring, 1 nauczyciel = 1 student). Docelowo RPC z transakcją.
- `**max_tokens=8192` koszt:** marginalnie więcej tokenów wyjściowych przy `count=6`. Akceptowalne — i tak rzadkie.
- **Skrócone etykiety mogą być niejasne:** mitygacja — pełne tooltips na każdym przycisku.
- `**useStudentNextStepsCount` dodatkowy query:** lekki count(*) z indexem, ~5 ms, akceptowalne.

Czekam na akceptację — wdrażam dokładnie w powyższej kolejności.