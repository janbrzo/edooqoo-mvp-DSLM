# Plan wdrożenia v6.9.9 — 4 problemy

Krótkie wyjaśnienie kontekstu: część rzeczy z planu Student Knowledge jest już wdrożona (migracja kolumn, edge function `classify-knowledge-entry`, uproszczony Quick Add, hook `useOneMinutePrep`, `OneMinutePrepCard` na StudentPage). Brakuje **3 elementów z pkt 1**, które dokończymy poniżej. Reszta planu (pkt 2-4) to naprawy maili i tła.

---

## PROBLEM 1 — Student Knowledge: dokończenie planu

### Co jest gotowe (weryfikacja):

- ✅ Migracja kolumn `ai_classified`, `ai_confidence`, `archived_at`, `used_in_worksheet_id`
- ✅ Edge function `classify-knowledge-entry` (Lovable AI, gemini-2.5-flash, tool-call schema)
- ✅ Quick Add bez wymogu kategorii (`StudentKnowledgeQuickAddModal`)
- ✅ `useStudentKnowledge.addEntry` → fire-and-forget classify
- ✅ `useOneMinutePrep` + `OneMinutePrepCard` na górze StudentPage

### Czego brakuje (do zrobienia w tej iteracji):

**1.1. Auto-archive „Next Lesson Ideas" po użyciu w worksheet**  
Obecnie kolumna `used_in_worksheet_id` jest schema-ready, ale nikt jej nie zapisuje. Dodajemy:

- W `src/components/student-knowledge/StudentKnowledgeSidePanel.tsx` (lub gdzie wyświetlane są Next Lesson Ideas) dodać przycisk **„Mark as used in worksheet"** dla wpisów `category='Next Lesson Ideas'` które mają `archived_at IS NULL` — manual flow na teraz (auto-link z worksheet generation jest poza scope tej iteracji, bo wymagałby zmian w `worksheetService.create`, czego unikamy).
- Nowa mutacja `archiveEntry(entryId, worksheetId?)` w `useStudentKnowledge`: ustawia `archived_at = now()` i opcjonalnie `used_in_worksheet_id`.
- `useOneMinutePrep` już filtruje po `archived_at IS NULL` ✅ — działa od razu.

**1.2. Three views — zakładki w `StudentKnowledgeSidePanel**`  
Obecny side panel ma jeden widok („Timeline"). Dodajemy Tabs (`@/components/ui/tabs`) z 3 zakładkami:

- **Timeline** (default, istniejący widok)
- **By Skill** — grupowanie `entries.filter(e => e.category === 'Skill Assessment')` po `metadata.nano_skill`, każda grupa pokazuje liczbę wpisów + ostatni `metadata.mastery` jeśli istnieje. Zero zmian w schema.
- **For Next Lesson** — używa danych z `useOneMinutePrep(studentId, teacherId)`; renderuje 3 sekcje (Personal hooks / Focus on / Lesson ideas) — zero duplikacji logiki, ten sam hook co `OneMinutePrepCard`.

**1.3. AI suggestion banner (opcjonalna kontrola nauczyciela)**  
Po klasyfikacji AI obecnie wpis jest cicho aktualizowany. Dodajemy delikatną informację wizualną:

- W `StudentKnowledgeEntryCard` (lub równoważnym) — jeśli `ai_classified === true && ai_confidence >= 0.6`, pokaż mały badge `<Sparkles className="h-3 w-3"/> AI organized` z tooltipem `confidence: {ai_confidence}`.
- Brak przycisku „Refine/Reject" — jeśli teacher nie zgadza się z kategorią, używa istniejącego trybu Edit (już istnieje). To minimalny dodatek bez nowego UI flow.

**1.4. Dokumentacja / memory**  

- Zaktualizować `mem://features/student-knowledge/quick-capture-and-ai-classify.md` — dopisać sekcję o `archived_at` i 3 widokach.
- Dopisać sekcję do `docs/llm-context.md` i `llms.txt`:
  ```
  ## Student Knowledge v6.9.9
  Problem: Friction-heavy categorization blocked in-lesson capture; no actionable lesson-prep view.
  Edooqoo Solution: Frictionless quick capture + background AI classification + 3-view side panel (Timeline / By Skill / For Next Lesson) + manual archive of used lesson ideas.
  Technical Mechanics: useStudentKnowledge.addEntry inserts as Notes, fires classify-knowledge-entry (gemini-2.5-flash, tool-call). Patches when confidence>=0.6. archiveEntry mutation sets archived_at + used_in_worksheet_id. useOneMinutePrep filters archived_at IS NULL. StudentKnowledgeSidePanel Tabs use shared data sources.
  RAG Keywords: student notes, knowledge entries, AI classification, lesson prep, next lesson ideas, archive, by skill view, frictionless capture
  ```

---

## PROBLEM 2 — Mail #1 (Supabase confirm signup): personalizacja + naprawa „Edooqoo · [hello@edooqoo.com](mailto:hello@edooqoo.com)"

### 2A. Skrzynka [hello@edooqoo.com](mailto:hello@edooqoo.com) nie istnieje

**Decyzja**: usuwamy literalny adres `hello@edooqoo.com` z treści maila. Zamiast tego stopka pokazuje sam brand „Edooqoo" — bez klikalnego adresu. (Reply-to dla tego maila Supabase i tak idzie na `noreply@mail.app.supabase.io`, więc obietnica „odpowiedz na ten mail" jest nieprawdziwa — usuwamy ją.)

Alternatywa odrzucona: catch-all forward `hello@ → edooqoo@gmail.com` wymaga konfiguracji DNS/MX poza zakresem aplikacji i nie jest pewne czy user ma do tego dostęp. Bez tego pokazywanie adresu wprowadza w błąd.

### 2B. Personalizacja imieniem

Supabase template ma dostęp do `{{ .Data.first_name }}` (z `raw_user_meta_data` przy `signUp({ options: { data: { first_name } } })`). Sprawdzimy `src/pages/Signup.tsx` czy `first_name` trafia do metadata — jeśli nie, dodamy. Template:

```
{{ if .Data.first_name }}Welcome, {{ .Data.first_name }}!{{ else }}Welcome to Edooqoo!{{ end }}
```

### Plik do podmiany: `docs/operational/supabase-confirmation-template.md`

Nowy HTML (do skopiowania ręcznie do Supabase Dashboard przez użytkownika):

```html
<!DOCTYPE html>
<html lang="en"><body style="margin:0;background:#fff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1220;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #e5e7eb;border-radius:12px;">
<tr><td style="padding:32px;">
<div style="font-size:14px;color:#5E3FD9;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Edooqoo</div>
<h1 style="margin:12px 0 8px;font-size:24px;color:#0b1220;">{{ if .Data.first_name }}Welcome, {{ .Data.first_name }}!{{ else }}Confirm your email{{ end }}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">Click the button below to activate your Edooqoo account. After confirming, you'll get a welcome email with next steps and 2 free tokens.</p>
<p style="text-align:center;margin:0 0 20px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#5E3FD9;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">Confirm email</a></p>
<p style="font-size:12px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:16px;">Edooqoo</p>
</td></tr></table></td></tr></table></body></html>
```

Zmiany vs obecny: (a) usunięcie `hello@edooqoo.com` ze stopki; (b) personalizacja H1 przez `{{ .Data.first_name }}`; (c) wzmianka o 2 free tokens (przeniesiona z poprzedniej wersji).

Dodatkowo: w `src/pages/Signup.tsx` zweryfikujemy czy `signUp` wysyła `options.data.first_name`. Jeśli nie ma — dodamy (drobna zmiana 1-linijkowa).

---

## PROBLEM 3 — Mail #2 Welcome (Resend): adres [hello@edooqoo.com](mailto:hello@edooqoo.com)

Ta sama logika co pkt 2A — brak skrzynki, więc:

- W `supabase/functions/send-welcome-email/index.ts` (linia 69-70): usunąć `hello@edooqoo.com` ze stopki, zostawić tylko „Edooqoo · helping English tutors save prep time" (lub podobne neutralne).
- Linia 69 „Questions? Just reply to this email — we read every message." → **zostawiamy**, bo `reply_to: 'edooqoo@gmail.com'` (linia 152) jest prawidłowe i odpowiedzi DOCIERAJĄ. To jedyna prawdziwa droga kontaktu — i tak działa.
- Linia 150 `from: 'Edooqoo <hello@edooqoo.com>'` — **zostawiamy** (Resend wymaga zweryfikowanej domeny do nagłówka From; działa jako display-only, fizyczne odpowiedzi przekierowuje `reply_to`).

Czyli **jedyna zmiana** to linia 70 — usunąć literalny adres ze stopki.

---

## PROBLEM 4 — Tło dla zalogowanych bez interakcji (hover)

Załączony plik `particlesjs-config_250_03_o100_nohover.json` różni się od obecnej konfiguracji w `ParticlesBackground.tsx` głównie wyłączeniem hover'a (`onhover.enable: false`).

### Implementacja

- Dodajemy prop `interactive?: boolean` do `ParticlesBackground` (default `true` = obecne zachowanie dla landing page).
- Kiedy `interactive={false}`: ustawiamy `onHover.enable: false` (ostatecznie też `onClick.enable: false`, żeby uniknąć dodawania cząsteczek przez przypadek w panelu pracy).
- W `AuthenticatedPageShell.tsx` (gdzie obecnie montujemy `<ParticlesBackground />` przy `pattern==='particles'`) — przekazać `interactive={false}`.
- Landing (`src/pages/Index.tsx`) zostaje bez zmian (`interactive` nieprzekazany → default `true`).

Dodatkowo upewniamy się, że `links.opacity` i `move.speed` w trybie `interactive=false` są zgodne z plikiem usera (`opacity: 1`, `speed: 0.3`) — ale obecna konfiguracja ma `opacity: 0.4`. Decyzja: dla `interactive=false` używamy wartości z pliku usera (cichsze tło, bez „grab" highlightu).

---

## Lista zmian plikowych (deterministyczna)


| Plik                                                              | Zmiana                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/hooks/useStudentKnowledge.tsx`                               | + mutacja `archiveEntry(entryId, worksheetId?)`                                                 |
| `src/components/student-knowledge/StudentKnowledgeSidePanel.tsx`  | + Tabs (Timeline / By Skill / For Next Lesson); + przycisk „Mark as used" dla Next Lesson Ideas |
| `src/components/student-knowledge/` (entry card)                  | + badge „AI organized" gdy `ai_classified`                                                      |
| `src/pages/Signup.tsx`                                            | weryfikacja/dodanie `options.data.first_name` w `signUp`                                        |
| `docs/operational/supabase-confirmation-template.md`              | nowy HTML z personalizacją + bez `hello@`                                                       |
| `supabase/functions/send-welcome-email/index.ts`                  | usunąć `hello@edooqoo.com` z linii 70                                                           |
| `src/components/landing/ParticlesBackground.tsx`                  | + prop `interactive`                                                                            |
| `src/components/AuthenticatedPageShell.tsx`                       | przekazać `interactive={false}`                                                                 |
| `mem/features/student-knowledge/quick-capture-and-ai-classify.md` | aktualizacja                                                                                    |
| `docs/llm-context.md` + `llms.txt`                                | sekcja v6.9.9 (Problem→Solution→Mechanics + RAG Keywords)                                       |


## Co BĘDZIE wymagało ręcznej akcji usera (1 krok)

Po wdrożeniu — wkleić nowy HTML z `docs/operational/supabase-confirmation-template.md` do Supabase Dashboard → Auth → Email Templates → Confirm signup. ZROBIONE RĘCZNIE 

## Co świadomie pomijamy w tej iteracji

- Auto-link `used_in_worksheet_id` z poziomu `worksheetService.create` (wymagałoby zmian w pipeline generacji — duże ryzyko regresji; manual button wystarcza).
- Helper `recordKnowledgeBackedEvent` w `useStudentEvents` (DSLM integration) — osobna iteracja DSLM.
- Auto-suggest „is this still current?" po 90 dniach — wymaga cron/notyfikacji, osobna iteracja.
- Catch-all forward `hello@edooqoo.com → edooqoo@gmail.com` — wymaga konfiguracji DNS/MX.