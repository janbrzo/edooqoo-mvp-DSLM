# Runbook: Bing, IndexNow, Cloudflare i wzmianki o marce poza stroną

Dla właściciela. Kroki do wykonania ręcznie, w kolejności. Teksty do wklejenia są po angielsku, reszta po polsku.

Dlaczego to ma znaczenie: odpowiedzi AI (ChatGPT, Perplexity, Gemini) opierają się na indeksach wyszukiwarek i na tym, co o produkcie piszą niezależne źródła. Według źródeł branżowych wzmianki o marce na zewnętrznych stronach korelują z widocznością w AI wyraźnie silniej niż linki, a ChatGPT korzysta m.in. z indeksu Bing. Dziś popyt na markę jest bliski zera ("edooqoo": 5 wyświetleń w 3 miesiące). Nie ma danych, które pokazałyby, ile da każdy z poniższych kroków, więc mierzymy wynik (sekcja 6).

## Kolejność

1. Zmerguj i wdróż PR #49 (zawiera plik klucza IndexNow). **Zapisz datę wdrożenia** w `docs/seo/checkpoint-2026-11.md`.
2. Sprawdź w przeglądarce, że klucz działa: `https://edooqoo.com/b0d429545b2a03cc5e81ab5521f7df9f.txt` ma pokazać dokładnie `b0d429545b2a03cc5e81ab5521f7df9f`.
3. Bing Webmaster Tools (sekcja 1).
4. IndexNow (sekcja 2).
5. Wzmianki poza stroną (sekcja 4), po jednej lub dwie na miesiąc.

## 1. Bing Webmaster Tools (ok. 15 minut)

1. Wejdź na https://www.bing.com/webmasters i zaloguj się kontem Microsoft lub Google.
2. Wybierz **Add a site** → **Import from Google Search Console**. Dzięki temu własność domeny jest potwierdzona automatycznie, bo w GSC już ją masz. (Jeśli import nie działa: weryfikacja przez DNS, rekord CNAME lub TXT u rejestratora domeny.)
3. Po imporcie otwórz **Sitemaps** i upewnij się, że jest `https://edooqoo.com/sitemap.xml`. Jeśli nie, dodaj ją.
4. **URL Inspection**: sprawdź 3 adresy (strona główna, `/tools/vocab-cefr-checker`, jeden z 10 przepisanych wpisów) i kliknij **Request indexing**, jeśli są niezaindeksowane.
5. Zapisz w tabeli poniżej: liczbę zaindeksowanych stron, kliknięcia i wyświetlenia z ostatnich 30 dni. Bing da tu mniejsze liczby niż Google, ale potrzebujemy punktu odniesienia.
6. Sprawdź ręcznie w Bing: `site:edooqoo.com` (ile wyników) oraz zapytania "edooqoo" i "edooqoo 1-minute prep".

| Data | Zaindeksowane (Bing) | Kliknięcia 30 dni | Wyświetlenia 30 dni |
|---|---:|---:|---:|
| (wpisz) | | | |

Jeśli w panelu Bing zobaczysz raport o cytowaniach w odpowiedziach AI (Copilot), zanotuj wartości. Nie potwierdziłem, że taki raport jest dostępny na tym koncie.

## 2. IndexNow (ok. 5 minut)

IndexNow to protokół, dzięki któremu Bing (i inne wyszukiwarki, które go obsługują) dowiaduje się od razu o zmienionych adresach. Klucz jest publiczny z założenia. Skrypt wysyła **tylko** adresy z `edooqoo.com`.

```bash
# podgląd (nic nie wysyła, sprawdza tylko, czy klucz jest na żywo)
npm run seo:indexnow -- --file=docs/seo/indexnow-urls-2026-10.txt

# wysyłka
npm run seo:indexnow -- --file=docs/seo/indexnow-urls-2026-10.txt --send
```

Lista (`docs/seo/indexnow-urls-2026-10.txt`, 171 adresów) zawiera: 10 przepisanych wpisów, 5 odblokowanych tras, 38 przekierowanych adresów i ich cele, 84 wyłączone strony oraz `/authors/martha`. Odpowiedź 200 lub 202 oznacza przyjęcie. Wysyłaj po każdym większym wdrożeniu tylko adresy, które się zmieniły (`--urls=/a,/b`).

## 3. Cloudflare Worker: rekomendacja to na razie NIE

Stan faktyczny (sprawdzony 2026-10-05):
- Domenę obsługuje hosting Lovable. Worker (`cloudflare/worker.mjs`) nie jest podpięty, więc nie działa produkcyjnie. Nagłówki `X-Robots-Tag` i prawdziwe 301 z niego nie docierają.
- Nieistniejące adresy **z rozszerzeniem** (np. `/blog/nie-ma.html`) zwracają prawdziwe 404.
- Nieistniejące adresy **bez rozszerzenia** (np. `/nie-ma-takiej-strony`) zwracają 200 i stronę główną. Aplikacja łagodzi to: `NotFound.tsx` ustawia `noindex`, usuwa canonical i dodaje sygnał 404 dla prerendera. To jest „soft 404” obsłużony po stronie klienta.
- Stare adresy mają stuby HTML z `meta refresh` i `canonical`, a nie nagłówek 301. Google traktuje natychmiastowy `meta refresh` podobnie do przekierowania, ale 301 jest pewniejsze.

Dlaczego odradzam teraz: żeby Worker działał, trzeba przenieść obsługę domeny na Cloudflare (DNS przez proxy, strona serwowana z `dist/` budowanego w CI). To zmiana hostingu: publikacja z Lovable przestaje aktualizować produkcję, a wszystko zależy od sekretów (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, klucze Supabase w CI) i od workflowa `cloudflare-worker-deploy.yml`. Zysk (prawdziwe 404 i 301, nagłówki) jest mały w porównaniu z ryzykiem awarii strony i nie jest powodem spadku ruchu, który widzimy.

Wrócimy do tego, jeśli: GSC pokaże dużo „soft 404”, albo będziemy chcieli przenieść hosting z innych powodów. Wtedy kroki to: (1) dodaj domenę do Cloudflare i sprawdź, że DNS zachowuje obecne rekordy, (2) ustaw zmienną `CLOUDFLARE_WORKER_DEPLOY_ENABLED=true` i sekrety w GitHub, (3) uruchom workflow ręcznie na staging/preview, (4) `npm run seo:verify-live-routing -- --strict-headers`, (5) dopiero potem przełącz ruch. Mogę przygotować pełny plan wdrożenia na osobną prośbę.

## 4. Wzmianki o marce poza stroną

### 4.1 Zasady

- Tylko prawdziwe, ujawnione wzmianki. Bez fałszywych kont, recenzji, zmasowanych wpisów i bez linków w ogólnych komentarzach.
- Jeden spójny opis produktu wszędzie (poniżej). Zmiana opisu = zmiana we wszystkich miejscach, gdzie już jest.
- Nie obiecuj efektów ("oszczędza X godzin", "najlepszy"). Nie wspominaj o funkcjach, których nie ma w produkcji. Brak publicznego API generowania arkuszy.
- Cel jest mierzalny: wzmianka ma prowadzić do jednego z adresów: `/`, `/tools/vocab-cefr-checker`, `/one-minute-prep`, `/features/placement-test`.

### 4.2 Opis produktu do wklejenia

**1 zdanie:**
Edooqoo is a lesson-preparation system for freelance English teachers and private tutors who run recurring one-to-one lessons with adult learners.

**Krótki (ok. 50 słów):**
Edooqoo is a lesson-preparation system for freelance English teachers and private tutors teaching adults one-to-one. It keeps each student's goals, diagnostic results and homework signals in one profile and turns them into editable worksheets and follow-up tasks the teacher reviews before use.

**Średni (ok. 100 słów):** jak krótki plus: *It includes a teacher-issued Welcome Test for placement, homework that students complete through a link, flashcards with spaced repetition, a lesson calendar with booking, and free browser tools such as a CEFR vocabulary checker and a lesson plan generator. Private teacher and student data stay inside the authenticated app.*

Wersja 200 słów jest w `docs/seo/external-evidence-playbook.md`.

### 4.3 Gdzie szukać miejsc (kolejność działań)

1. **Źródła, które AI już cytuje.** Przy następnym panelu AI (30 zapytań z `docs/seo/ai-search-query-set.md` w ChatGPT, Perplexity, Gemini i Claude) zapisz, jakie strony cytują w odpowiedziach na "best AI tools for ESL teachers" i podobne. To są cele numer jeden: zestawienia, katalogi, wątki.
2. **Zestawienia "best AI tools for English teachers/tutors".** Napisz do autora (szablon niżej), zaproponuj konto demo i prawdziwy przykład arkusza.
3. **Katalogi narzędzi AI/EdTech** z darmowym zgłoszeniem: wybierz 2–3 aktywne, sprawdź, czy mają ostatnie wpisy, zgłoś produkt opisem z 4.2.
4. **Reddit i grupy dla nauczycieli** (r/TEFL, r/ESL_Teachers, r/OnlineESLTeaching, grupy FB tutorów): odpowiadaj na realne pytania ("jak szybko przygotować lekcję 1:1", "jak śledzić postępy ucznia") merytorycznie, z ujawnieniem ("I built Edooqoo"), link na końcu i tylko gdy pasuje. Najpierw przeczytaj regulamin forum. Maksymalnie 1–2 odpowiedzi tygodniowo.
5. **YouTube**: 2–4 minutowe demo prawdziwego przepływu (profil ucznia → arkusz → homework → przegląd). Opis filmu z linkiem i opisem z 4.2. Wideo jest częstym źródłem cytowanym przez odpowiedzi AI.
6. **G2 i Capterra**: dopiero gdy będą realni użytkownicy, którzy napiszą opinie. Nie zakładamy profili tylko po to, by je mieć.

### 4.4 Szablon wiadomości do autora zestawienia

> Subject: Edooqoo for your "best AI tools for English tutors" list
>
> Hi [name], I read your list on [page]. I'm the founder of Edooqoo, a lesson-preparation system for freelance English teachers and private tutors who teach adults one-to-one. It keeps each student's goals, diagnostic results and homework in one profile and turns them into worksheets the teacher edits before use.
>
> If it fits your criteria, I'd be glad to give you a free account and a sample of what it produces for a recurring adult learner. Our CEFR vocabulary checker (https://edooqoo.com/tools/vocab-cefr-checker) is free and needs no sign-up, which may be useful to your readers.
>
> No obligation, and I'm happy to answer any question about what it does and doesn't do.
> [Jan Brzostowski, Edooqoo]

### 4.5 Szkic odpowiedzi na Reddit (dostosuj do pytania)

> I teach adults 1:1 and the thing that saved me most prep time was keeping each student's goals and recent errors in one place and building the next lesson from that, instead of starting from a blank page each week. Whatever tool you use, I'd write down for each learner: the real task they need English for, the one error that blocked them last lesson, and what they could do independently. Disclosure: I built Edooqoo, which does this kind of student profile plus editable worksheets, so I'm biased. Happy to share how I structure it by hand if that's useful.

### 4.6 Rejestr wzmianek (uzupełniaj)

| Data | Miejsce | Adres wzmianki | Status | Ruch z odsyłacza (30 dni) |
|---|---|---|---|---:|
| (wpisz) | | | | |

## 5. Czego nie robić

- Zmasowanych zgłoszeń do katalogów ani płatnych linków. Fałszywych recenzji i kont. Komentarzy, których jedynym celem jest link.
- Wzmianek o funkcjach spoza produkcji (BETA/ROADMAP) ani porównań z konkurencją bez źródła.
- Zmiany opisu produktu tylko w jednym miejscu.

## 6. Jak mierzymy wynik

Raz w miesiącu (patrz `docs/seo/checkpoint-2026-11.md`):
- GSC: wyświetlenia zapytania "edooqoo" (baza: 5 w 3 miesiące) i zapytań z marką.
- Bing Webmaster: zaindeksowane strony, kliknięcia.
- Ruch z odsyłaczy chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com.
- Panel AI (30 zapytań, 4 silniki): czy Edooqoo jest wymieniony i czy poprawnie opisany.
- Rejestracje nauczycieli według źródła.
