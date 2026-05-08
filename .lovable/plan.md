## Plan v6.9.10 — Knowledge audit + Worksheet form Next-Step preset

Cztery niezależne bloki. Każdy można wdrożyć osobno bez ryzyka regresji.

---

## BLOK 1 — Jak DZIŚ działa System Notatek (Student Knowledge), opisowo

To nie jest zadanie do implementacji — to inwentaryzacja, której potrzebujesz przed decyzją o BLOKU 2. Po wdrożeniu v6.9.8 + v6.9.9 stan jest następujący:

### 1.1 Wejście danych (jak nauczyciel dodaje notatkę)

Trzy ścieżki, wszystkie trafiają do tej samej tabeli `student_knowledge_entries`:

- **Quick Add (główna)** — komponent `StudentKnowledgeQuickAddModal`. Otwierany z FAB-a (ikonka książki w prawym dolnym rogu strony studenta) lub z przycisku „Add note". Pokazuje TYLKO pole tekstowe + opcjonalne tagi. Brak wymaganej kategorii. Po zapisie wpis trafia natychmiast do bazy z `category='Notes'`.
- **Live Session Quick Notes** — pasek na dole ekranu Live Session (`LiveSessionQuickNotes`). Tu nauczyciel WYBIERA kategorię ikonką (Personal / Skill / Goals / Notes / Next Lesson) i wpisuje notatkę. To świadoma decyzja — w trakcie lekcji nauczyciel wie, czego dotyczy obserwacja.
- **Side Panel (zaawansowane)** — `StudentKnowledgeSidePanel`. Pełna edycja: kategoria, podtyp (np. dla Skill Assessment: strength/weakness/mistake/practice), nano_skill, mastery 0-100, sub_category dla Personal itd. Używane do edycji istniejących wpisów albo świadomego, bogato strukturalnego dodania.

### 1.2 Co się dzieje PO zapisaniu Quick Add (auto-klasyfikacja AI)

W `useStudentKnowledge.addEntry` po insercie wpisu odpalany jest **fire-and-forget** request do edge function `classify-knowledge-entry` (Lovable AI Gateway, model `google/gemini-2.5-flash`, tool-calling). Nauczyciel NIE czeka — UI nie blokuje się.

AI dostaje tekst notatki + level studenta + jego główny cel i zwraca:
- `category` (jedna z 5: Skill Assessment, Personal, Goals, Next Lesson Ideas, Notes),
- `confidence` 0..1,
- `tags` (1-4 słowa kluczowe),
- jeśli Skill Assessment → `skill_subtype` + `element_type` + opcjonalnie `nano_skill` + `suggested_mastery`,
- jeśli Personal → `sub_category`,
- `summary` — jednolinijkowe streszczenie.

Jeśli `confidence >= 0.65` (tak ma prompt) — klient patchuje wiersz: zmienia category na sugerowaną, zapisuje metadata, ustawia `ai_classified=true`, `ai_confidence=…`. Jeśli mniej pewne — zostaje jako `Notes`.

Skutek: nauczyciel pisze „Tomek myli used to z would" → po sekundzie wpis sam staje się Skill Assessment / weakness / grammar.

### 1.3 Co nauczyciel widzi (3 widoki w `StudentKnowledgeSection`)

Sekcja na karcie studenta („Knowledge" tab) ma 3 zakładki (Tabs):

- **Timeline** (default) — chronologiczna lista wszystkich wpisów. Każdy wpis (`StudentKnowledgeEntryCard`) pokazuje: kategorię (kolorowa kropka), treść, tagi, datę, ikonę „Sparkles AI organized" jeśli wpis pochodzi z auto-klasyfikacji z `confidence >= 0.6`, oraz menu (edit / delete / mark outdated).
- **By Skill** — grupuje WYŁĄCZNIE wpisy `Skill Assessment` po `metadata.nano_skill` (np. „past simple irregular verbs", „phone vocabulary"). Pod każdą umiejętnością widać mini-pasek mastery (z `metadata.suggested_mastery`) i wszystkie powiązane wpisy. To jest mapa „co umie / czego nie umie ten uczeń" w jednym miejscu.
- **For Next Lesson** — czerpie z hooka `useOneMinutePrep`. Pokazuje 3 sekcje, max 3 wpisy każda:
  - Personal Hooks (świeże Personal z ostatnich 30 dni — do small-talku),
  - Top Weaknesses (Skill Assessment z subtypami weakness/mistake/practice — co ćwiczyć),
  - Lesson Ideas (Next Lesson Ideas, które jeszcze nie są zarchiwizowane).
  Każda karta w sekcji „Lesson Ideas" ma przycisk **„Mark as used"** → mutacja `archiveEntry(id)` ustawia `archived_at=now()` i wpis znika z tej listy (zostaje w Timeline). Dzięki temu nauczyciel po lekcji szybko czyści to, co już zrealizował.

### 1.4 Skąd te dane są używane W INNYCH miejscach aplikacji

- **Side Panel + Mini List** — pasek/panel na różnych ekranach studenta (np. podczas oglądania worksheeta) pokazuje skondensowaną listę.
- **`OneMinutePrepCard`** — karta „1-Minute Prep" pojawia się na stronie studenta nad listą worksheetów; to ten sam digest co zakładka „For Next Lesson".
- **Lesson Ideas Button** — w paskach narzędzi (`StudentKnowledgeLessonIdeasButton`) dropdown z aktywnymi pomysłami.
- **Worksheet Generation prompt** — `format-worksheet-prompt` edge function dolewa do promptu skrót knowledge'u studenta (Personal facts + recent weaknesses), żeby AI personalizowała ćwiczenia. Ten przepływ jest gotowy i działa.

### 1.5 Co wpadło, czego NIE ma (kontekst do BLOKU 2)

- NIE ma automatycznego ustawiania `used_in_worksheet_id` przy generacji worksheeta (tylko ręczny przycisk).
- NIE ma helpera DSLM, który powiązałby wpisy z eventami nauki.
- NIE ma cron-a „is this still current?" po 90 dniach.

To są te 3 świadome pominięcia z poprzedniej iteracji.

---

## BLOK 2 — 3 pominięte funkcje: rekomendacja per pozycja

Decyzja per pozycja, czy domykać teraz czy zostawić:

### 2.1 Auto-link `used_in_worksheet_id` z poziomu generacji worksheeta

**Rekomendacja: NIE domykamy w v6.9.10. Robimy w osobnej, dedykowanej iteracji „Worksheet ↔ Knowledge bridge".**

Powód: wymaga modyfikacji `worksheetService` + `useWorksheetGeneration` (nie samego promptu — to jest święte), z dokładnym matchingiem „który wpis Next Lesson Ideas został właśnie zrealizowany". Bez UX-u potwierdzenia („Did this worksheet cover idea X?") system będzie albo over-archive (znikają wpisy, których nauczyciel nie zrealizował) albo nigdy nie trafia. Ręczny przycisk „Mark as used" działa, jest jednoznaczny, zero ryzyka. Wracamy do tego, jak będziemy projektowali pełny flow „suggestion → worksheet → review".

### 2.2 Helper `recordKnowledgeBackedEvent` w `useStudentEvents` (DSLM)

**Rekomendacja: NIE w v6.9.10. To część osobnej iteracji DSLM.**

Powód: DSLM ma swój własny model zdarzeń (`useStudentEvents`, `dslm_events`, kalkulacja confidence). Zlepianie tego z Knowledge bez przemyślenia, jak mastery z notatki nauczyciela ma rywalizować z mastery z faktycznych ćwiczeń, popsuje confidence score. Wymaga osobnego specu.

### 2.3 Auto-suggest „is this still current?" po 90 dniach

**Rekomendacja: TAK, ale tylko jako klient-side w v6.9.10 (zero infrastruktury cron).**

Wystarczy dodać w `StudentKnowledgeEntryCard` mały badge „Stale (90+ days) — still relevant?" gdy `created_at < now() - 90d` AND `is_outdated=false` AND `category IN ('Personal','Skill Assessment','Goals')`. Badge ma dwa szybkie buttony: „Still current" (ustawia `created_at = now()` żeby zresetować zegar — albo lepiej dodaje `metadata.last_confirmed_at`) i „Mark outdated" (istniejąca mutacja `markAsOutdated`).

Brak cron-a, brak emaili, brak edge functions. Pure UI computed property. Ryzyko regresji: zerowe.

**Implementacja BLOK 2.3:**
- W `StudentKnowledgeEntryCard.tsx` dodać `isStale = differenceInDays(now, entry.created_at) >= 90 && !entry.is_outdated && ['Personal','Skill Assessment','Goals'].includes(entry.category)`.
- Renderować pod treścią mały żółty badge `<Clock /> Stale — still true?` z dwoma textbuttonami `Yes, still current` / `Mark outdated`.
- „Yes, still current" → nowa mutacja `confirmCurrent(id)` w `useStudentKnowledge` która patchuje `metadata = { ...metadata, last_confirmed_at: new Date().toISOString() }`. W `isStale` używać `max(created_at, metadata.last_confirmed_at)`.
- „Mark outdated" → istniejące `markAsOutdated`.

---

## BLOK 3 — `generate-curriculum-phases` vs `generate-timeline` (różnica, kiedy używane)

To DWIE różne edge functions na dwóch poziomach planowania. Obie istnieją po stronie Supabase (w repo widać tylko hooki które je wywołują: `useCurriculumPhases.tsx` i `useFutureTimeline.tsx`).

### 3.1 `generate-curriculum-phases` — POZIOM MAKRO (fazy curriculum)

- **Wywoływana z**: `useCurriculumPhases.generatePhases()` w komponencie `MacroTimeline` na zakładce Progress studenta.
- **Co generuje**: 3-6 dużych „faz nauki" (`dslm_curriculum_phases`), np. Faza 1: „Foundational business email vocab" (4-6 tygodni), Faza 2: „Negotiation phrasing" (3-4 tyg.). Każda faza ma: title, description, status (planned/in_progress/done), `estimated_weeks_start/end`, `focus_areas[]`, rationale.
- **Kontekst**: cele studenta, jego level, główny goal, dotychczasowe Skill Assessment z Knowledge, performance z DSLM.
- **NIE generuje konkretnych worksheetów** — to jest mapa drogowa: „w jakim porządku ten student powinien iść przez najbliższe 3-6 miesięcy".

### 3.2 `generate-timeline` — POZIOM MIKRO (konkretne worksheety = next steps)

- **Wywoływana z**: `useFutureTimeline.generateNextSteps()` i `regenerateInPlace()`.
- **Co generuje**: 1-3 konkretnych pomysłów na worksheet (`future_worksheet_suggestions`), każdy z: `topic`, `goal`, `additionalInfo`, `grammarFocus`, `exercises[]` (gotowy zestaw 8 ćwiczeń), `exerciseFocusMap` (focus per ćwiczenie), `rationale`, `focusSkills[]`, `difficulty`.
- **Dwa tryby**:
  - `mode='next_steps'` (`phaseId=null`) — luźne pomysły, niezwiązane z fazą,
  - `mode='phase_steps'` (`phaseId=<id fazy>`) — pomysły skrojone pod konkretną fazę z `dslm_curriculum_phases`. Wynik dostaje `suggestion_kind='phase_step'` + `phase_id`.
- **TO jest źródło tego, co użytkownik zobaczy w „Next Steps" na profilu studenta** — i co chcemy podnieść do formularza w BLOKU 4.

### 3.3 Hierarchia (mental model dla ciebie)

```text
Goals studenta (np. „awans na seniora w IT")
   ↓
generate-curriculum-phases  →  Fazy (3-6 bloków × tygodnie)
   ↓
generate-timeline           →  Konkretne worksheety w ramach fazy
   ↓
Worksheet generation engine →  Wypełniony worksheet z ćwiczeniami
```

Dwa różne prompty, dwa różne poziomy abstrakcji, dwie różne tabele. Nie nakładają się.

---

## BLOK 4 — Preset „Next Step" na formularzu generowania

To jedyny realny blok do implementacji w v6.9.10.

### 4.1 Cel UX (tak jak chcesz)

Po wybraniu ucznia w selectorze na `WorksheetForm`:
- **Jeśli student MA aktywne `next_steps`** (`useFutureTimeline.nextSteps` non-empty): pokazujemy elegancki banner-pasek z 1-3 chipami „Use preset" — kliknięcie wpełnia formularz (topic, goal, additionalInfo, grammarFocus, exercises, focusMap) z wybranego next_step.
- **Jeśli student NIE MA next_steps**: pokazujemy łagodny banner „No learning plan yet — your worksheets will be more cohesive if you add one. [Open Learning Plan ↗]" linkujący do zakładki Progress studenta.

Banner musi:
- mieścić się wizualnie nad sekcją „Exercise Selection Cards" (linia 603-642),
- zwijać się gdy nie ma studenta lub student nie istnieje (no-student),
- być responsywny (mobile = pełna szerokość),
- nie rozjeżdżać layoutu — używać tych samych szerokości i marginesów co istniejące karty.

### 4.2 Nowy komponent: `src/components/WorksheetForm/NextStepsPresetBanner.tsx`

```text
Props:
  studentId: string | null     // null = no-student
  teacherId: string
  onApplyPreset: (preset: PresetPayload) => void

PresetPayload {
  topic, goal, additionalInfo, grammarFocus,
  exercises: string[],
  exerciseFocusMap: Record<string,string>,
  mediaTypes: MediaType[]      // wyderywowane z exercises (fill-in-blanks-audio → ['audio'])
  sourceSuggestionId: string   // żeby potem móc wywołać useSuggestion()
}
```

Wewnątrz:
- Wczesny return `null` jeśli `!studentId`.
- `const { nextSteps, phaseSteps, loading } = useFutureTimeline({ studentId, teacherId })`.
- Łączymy: `const presets = [...nextSteps, ...phaseSteps].slice(0,3)` (preferujemy phase_steps na początku — bardziej kontekstowe; albo zostawiamy tylko nextSteps — patrz 4.5 Decyzje).
- Stan ładowania: skeleton bar (1 linia, h-10).
- **Pusty stan**: jasno-żółty banner z `<Lightbulb />` + tekst „No learning plan for **{studentName}** yet. Plans help AI generate cohesive, goal-driven worksheets." + button outline „Open Learning Plan" → `navigate(`/student/${studentId}?tab=progress`)`.
- **Z presetami**: poziomy pasek tła `bg-purple-50/50 dark:bg-purple-900/10` z label „Suggested next steps:" i 1-3 chipami. Każdy chip = `<Button variant="outline" size="sm">` z ikonką ✦, tekstem `{preset.suggested_topic}` (truncate max 30 znaków + tooltip z pełnym opisem + rationale) i klik → `onApplyPreset(...)`.

### 4.3 Integracja w `WorksheetForm/index.tsx`

Bez modyfikacji żadnego istniejącego stanu/promptów. Dodajemy:

1. **Import**: `import { NextStepsPresetBanner } from './NextStepsPresetBanner';`
2. **Auth context**: `WorksheetForm` ma już `userId` i `selectedStudentId`. Potrzebujemy `teacherId === userId`.
3. **Handler `applyPreset`** — analogiczny do istniejącego mechanizmu prefill z sessionStorage (ale bez rerouting przez sessionStorage):
   ```text
   const applyPreset = (p: PresetPayload) => {
     setLessonTopic(p.topic);
     setLessonGoal(p.goal ?? '');
     setAdditionalInformation(p.additionalInfo ?? '');
     setGrammarFocus(p.grammarFocus ?? '');
     // użyj normalizeSuggestionPrefill — to samo co już działa dla DSLM
     const norm = normalizeSuggestionPrefill({
       exercises: p.exercises, focusMap: p.exerciseFocusMap,
       mediaTypes: p.mediaTypes, lessonTime,
     });
     setSelectedMediaTypes(norm.selectedMediaTypes as MediaType[]);
     setSelectedExercises(norm.selectedExercises);
     setExerciseFocusMap(norm.exerciseFocusMap);
     setSelectionMode('manual');
     setActiveTab('exercises');
     toast.success('Preset applied — review and generate');
     // WAŻNE: NIE wywołujemy useSuggestion() tutaj. Robimy to dopiero po sukcesie generacji
     // przez istniejący mechanizm window event 'suggestionMarkedUsed'.
     // Zapisujemy id do sessionStorage:
     sessionStorage.setItem('appliedPresetSuggestionId', p.sourceSuggestionId);
   };
   ```
4. **Renderowanie** — bezpośrednio NAD blokiem `{/* Exercise Selection Cards */}` (linia 603), ALE poniżej selektora ucznia. Selektor zostaje gdzie jest. Banner umieszczamy w nowym `<div className="mb-3">`.

   Aktualnie selector ucznia jest WEWNĄTRZ tej samej linii co Exercise/Time cards (linia 605-641). To utrudnia wstawienie pełnoszerokościowego bannera. Dlatego:

   **Refactor minimalny**: wyciągamy `studentName` z `students.find(...)` i renderujemy banner JAKO OSOBNY blok przed `<div className={`flex ${isMobile...}>`}`. Banner kolapsuje się gdy `selectedStudentId === 'no-student'`. Zero zmian w samym selektorze.

5. **Powiązanie „preset → mark as used" po sukcesie generacji**:
   W `useWorksheetGeneration` (lub w handlerze `worksheetGenerationSuccess` w WorksheetForm) po sukcesie:
   ```text
   const id = sessionStorage.getItem('appliedPresetSuggestionId');
   if (id && newWorksheetId) {
     // wywołaj useSuggestion(id, newWorksheetId) — wymaga dostępu do hooka
     window.dispatchEvent(new CustomEvent('markPresetUsed', { detail: { id, worksheetId: newWorksheetId } }));
     sessionStorage.removeItem('appliedPresetSuggestionId');
   }
   ```
   I w `NextStepsPresetBanner` (który ma `useFutureTimeline`) listener:
   ```text
   useEffect(() => {
     const h = (e: any) => useSuggestion(e.detail.id, e.detail.worksheetId);
     window.addEventListener('markPresetUsed', h);
     return () => window.removeEventListener('markPresetUsed', h);
   }, [useSuggestion]);
   ```
   To re-używa istniejący wzorzec event-driven (`suggestionMarkedUsed` jest już w `useFutureTimeline` linia 391-395).

### 4.4 Kompatybilność z istniejącym DSLM prefill

WorksheetForm ma już mechanizm prefill z sessionStorage (`prefillExercises`, `prefillExerciseFocusMap`, `prefillMediaTypes`, `prefillWorksheet` z linii 180-244). Nasz `applyPreset` używa TEJ SAMEJ funkcji `normalizeSuggestionPrefill` co istniejący DSLM prefill — więc nie ma rozjazdu między dwiema ścieżkami prefill. Różnica: my robimy to w-place (state setters), sessionStorage używamy tylko do trackowania `sourceSuggestionId` przez cykl generacji.

### 4.5 Decyzje, które ja podejmuję teraz (żebyś nie musiał)

- **Co pokazujemy w bannerze**: top 3 z `[...phaseSteps, ...nextSteps]` (phase_steps mają wyższy priorytet, są bardziej osadzone w planie). Jeśli phase_steps puste → wszystkie 3 z nextSteps.
- **Liczba chipów**: max 3, min 1.
- **Kolory**: banner używa istniejącego `bg-worksheet-purpleLight` (jest w design system) dla spójności z resztą formularza.
- **Empty state CTA**: link do `/student/${id}?tab=progress&action=generate-timeline` — query param `action` zostanie obsłużony w przyszłej iteracji (na teraz wystarczy nawigacja do tabu, user kliknie sam Generate).
- **Loading state**: 1-linijkowy `Skeleton` h-10 — bez migotania.
- **Niedostępność (anonimowy / no-student)**: banner zwinięty (return null), bo nie ma kontekstu studenta.
- **Anti-rozjazd**: banner ma stały `min-h-[44px]` żeby przejście empty→presets→loading nie ruszało wysokości formularza.

### 4.6 Ryzyko regresji

Zerowe dla istniejących ścieżek:
- Nie modyfikujemy promptu generacji (sanctity OK).
- Nie modyfikujemy `useWorksheetGeneration` poza dodaniem 1 dispatcha (opcjonalne, można też zostawić — jeśli nie ustawimy `is_used`, nauczyciel kliknie ręcznie „Mark as used").
- Nie modyfikujemy `useFutureTimeline` ani edge functions.
- Selector ucznia wygląda i działa tak jak teraz.

---

## BLOK 5 — Dokumentacja (RAG)

Wpisy do `docs/llm-context.md` i `llms.txt` — sekcja **v6.9.10**, struktura Problem → Solution → Mechanics + RAG Keywords:

### 5.1 Wpis 1: Worksheet Form — Next-Step Preset

- **Problem**: nauczyciel generujący worksheet dla studenta nie widzi wcześniej wygenerowanych „next steps" → tworzy ad-hoc, ignoruje plan, materiały tracą spójność.
- **Solution**: banner pod selektorem ucznia z top 3 next_steps, klik = prefill. Empty state zachęca do utworzenia learning plan.
- **Mechanics**: `NextStepsPresetBanner` → `useFutureTimeline.nextSteps + phaseSteps`. Apply używa `normalizeSuggestionPrefill`. Po sukcesie generacji dispatch `markPresetUsed` → `useSuggestion(id, worksheetId)`. Sanctity: prompt engine niemodyfikowany.
- **RAG Keywords**: preset, next step, learning plan, suggestion chip, prefill from suggestion, worksheet form student selector, future timeline preset, lesson preset.

### 5.2 Wpis 2: Stale Knowledge Badge

- **Problem**: notatki Personal/Skill/Goals starsze niż 90 dni mogą być nieaktualne (zmiana pracy, awans, nawyk już opanowany), a nauczyciel ma do nich zaufanie jak do świeżych.
- **Solution**: client-side badge „Stale — still true?" z dwoma akcjami: confirm current (resetuje `metadata.last_confirmed_at`) lub mark outdated.
- **Mechanics**: computed `isStale` w `StudentKnowledgeEntryCard`, mutacja `confirmCurrent` w `useStudentKnowledge` (patchuje metadata). Brak cron-a / brak edge function. `markAsOutdated` istnieje.
- **RAG Keywords**: stale note, knowledge freshness, confirm current, 90 days outdated, knowledge audit.

### 5.3 Wpis 3: Knowledge System Mental Model (sekcja edukacyjna)

Dla przyszłych agentów: opisz wprost relację Knowledge ↔ Curriculum Phases ↔ Future Timeline ↔ Worksheet Generation. Diagram tekstowy z BLOK 3.3.

### 5.4 Update `mem/features/student-knowledge/quick-capture-and-ai-classify.md`

Dodać akapit „v6.9.10: Stale badge + Worksheet form preset integration".

### 5.5 Nowa pamięć: `mem/features/worksheet-form/next-step-preset.md`

Plik z zasadą: „WorksheetForm pokazuje banner presetów per student. Apply używa normalizeSuggestionPrefill. Mark-as-used przez window event po sukcesie generacji. Nigdy nie modyfikować promptu generacji."

---

## Zakres do implementacji w v6.9.10 (po zatwierdzeniu)

1. **BLOK 2.3** — Stale badge (1 komponent, 1 mutacja w hook).
2. **BLOK 4 całość** — `NextStepsPresetBanner` + integracja w `WorksheetForm` + dispatch po sukcesie generacji.
3. **BLOK 5** — dokumentacja RAG + 1 nowy plik mem.

**NIE w tej iteracji**: BLOK 2.1 (auto-link worksheet), BLOK 2.2 (DSLM helper) — czekają na osobne iteracje.

**Sanctity**: zero zmian w promptach worksheet engine, zero zmian w edge functions `generate-curriculum-phases` / `generate-timeline` / `format-worksheet-prompt`.
