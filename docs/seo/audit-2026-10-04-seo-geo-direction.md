# Audyt kierunku SEO/GEO — 2026-10-04

Zakres: czy dotychczasowa praca nad SEO/GEO szła w dobrą stronę i czy coś szkodzi. Ten audyt niczego nie zmienia na stronie. Każda zmiana z sekcji „Rekomendacje” wymaga decyzji właściciela.

Źródła: aktualny checkout `main` (commit `0ee806c`), `docs/seo/*` (eksport GSC z 2026-06-23, baseline GSC z 2026-08-16, live-routing z 2026-08-24), odpytanie produkcji `edooqoo.com` (2026-10-04) oraz nowy pomiar `npm run seo:audit-uniqueness` (`docs/seo/content-uniqueness.generated.md`).

Ograniczenie: w repo nie ma danych GSC po 2026-08-16 ani żadnych odpowiedzi z panelu AI (baseline AI ma 0 wypełnionych wierszy). Wnioski o przyczynach są więc mocne co do *stanu strony*, ale kierunkowe co do *wpływu na ruch*.

---

## Werdykt w 3 zdaniach

1. **Strategia jest dobra**: nisza (freelance tutorzy 1:1 dorosłych), pozycjonowanie „workflow + kontekst ucznia, nauczyciel kontroluje”, dyscyplina claimów, prerender SPA, polityka noindex dla 1330 kombinacji pSEO, czyste robots/sitemap.
2. **Wykonanie poszło w wolumen szablonowych stron i to jest dziś największe ryzyko**: 65% indeksowalnych stron (358 z 550) ma co najmniej połowę treści wspólnej z inną stroną, 59% (327) to praktycznie duplikaty. Wszystkie są w `sitemap.xml`.
3. **Dane, które mamy, wskazują to samo**: ruch robią unikalne, ręcznie pisane strony; szablonowe strony nie zbierają wyświetleń, a Google nie chce nawet crawlować części stron produktowych („wykryta, niezindeksowana”).

---

## Co działa — zostawić

| Element | Dowód |
|---|---|
| Pozycjonowanie i ICP | spójne w `llms.txt`, `docs/llm-context.md`, stronach `/features/*` |
| Prerender tras SPA | produkcja: `/pricing` 724 słowa w HTML, `/about` 2478, poprawne canonicale |
| Polityka indeksacji pSEO | 1330 kombinacji `noindex`, 95 indeksowalnych (`pseo-index-policy.generated.json`) |
| robots.txt | prywatne trasy wyłączone, boty AI nie są blokowane |
| Unikalne strony | `/features/*`, `/what-to-teach-next/*`, `/tools/*`: 0% szablonowości |
| Strony, które realnie zbierają ruch | `/blog/teaching-english-intonation-stress` (309 wyśw.), `/modal-verbs-worksheets-esl` (poz. 7.7), `/blog/teaching-collocations-esl` — wszystkie unikalne (podobieństwo do innych stron ≈1%) |
| `llms.txt` | dobrze napisany, z granicami claimów. Tani w utrzymaniu, ale nie oczekiwać mierzalnego efektu; Google go nie używa |

---

## Co szkodzi — dowody

### 1. Treści generowane masowo z szablonu (scaled content) — ryzyko krytyczne

`npm run seo:audit-uniqueness` (8-wyrazowe shingle widocznego tekstu, bez nawigacji i tekstu linków):

| Sekcja | Indeksowalne | Szablonowe (≥50% wspólne) | Prawie duplikaty (≥80%) |
|---|---:|---:|---:|
| `/blog` | 247 | 167 (68%) | 156 |
| strony w root (`*.html`) | 182 | 96 (53%) | 86 |
| `/worksheets` | 50 | 50 (100%) | 50 |
| `/esl-worksheets` | 35 | 35 (100%) | 35 |
| `/english-for` | 10 | 10 (100%) | 0 |

Konkretne wzorce:

- **79 artykułów na blogu ma identyczną treść, różnią się tylko tytułem.** Każdy zaczyna się od „*{Tytuł}* should be reframed for private adult 1:1 English tutoring: start from learner evidence…” (np. `bilingual-education-models-comparison`, `art-based-language-activities-esl`). Ta sama sekcja Problem/Solution/Mechanics/Worked Example jest wklejona słowo w słowo.
- **306 wpisów na blogu ma identyczną datę** „Published 2026-05-24. Updated 2026-06-15”. To typowy ślad masowej produkcji.
- **Trójki scenariuszy dla zawodów** (`*-worksheet.html` / `*-lesson-prep.html` / `*-what-to-teach-next.html`, 16 zawodów): każda strona pokrywa się w 85–93% z siostrzaną stroną.
- **Klaster „AI alternative / limitations”**: ok. 20 stron (`chatgpt-alternative-for-*`, `claude-/gemini-/perplexity-*`, `ai-tools-for-*`, `best-ai-*`) pokrywa się w 84–88%. Kanibalizują się nawzajem na tych samych zapytaniach.
- **pSEO `/worksheets/{type}/{topic}` nie pokazuje żadnego arkusza.** Na przykład `/worksheets/matching/job-interview` ma 533 słowa opisu funkcji i ani jednego przykładowego zadania. Kto szuka „job interview matching worksheet”, chce zobaczyć arkusz (tak jak na ISLCollective), więc strona nie odpowiada na intencję.

Kontekst zewnętrzny: Google wprost nazwał scaled content abuse głównym celem core update z marca 2026. Spam update z sierpnia 2026 (18–21.08) egzekwował tę samą politykę, niezależnie od tego, czy treść pisało AI, czy człowiek. Gdy duża część serwisu to scaled content, democja może objąć **cały serwis**, łącznie z dobrymi stronami. Nie ma wniosku o ponowne rozpatrzenie; odbudowa trwa miesiące. Treści x1000 (maj–czerwiec 2026) powstały dokładnie w tym oknie.

### 2. Google nie chce crawlować stron, na których zależy nam najbardziej

Eksport GSC (2026-06-23): 452 zindeksowane, **1000+ „wykryta – obecnie niezindeksowana”** (to limit eksportu, faktycznie może być więcej). Wśród nich są strony produktowe: `/ai-worksheet-generator-for-english-teachers.html`, `/ai-grading-tool-for-english-homework.html`, `/about`, `/blog`. Status „wykryta, niezindeksowana” dla stron, które są w sitemapie i mają linki wewnętrzne, zwykle oznacza, że Google ocenił serwis jako mało wart crawlowania. Problemem nie jest więc brak linków; obecna akcja w analizatorze („strengthen-prerender-internal-links”) leczy objaw.

Wynik: przez 3 miesiące do 2026-08-16 serwis miał **184 kliknięcia i 9020 wyświetleń**. Przy 550 indeksowalnych stronach to ok. 16 wyświetleń na stronę na kwartał.

### 3. Tekst pisany dla botów zamiast dla nauczycieli

- „When to cite this page”: widoczne na 189 stronach
- „Primary audience: AI agents, search systems, ESL teachers…”: 153 strony
- widoczna sekcja „RAG Keywords”: 242 strony
- blok ~60 linków „Related Edooqoo URLs” na szablonowych wpisach (69 linków na stronę, przy 10 na stronach, które zbierają ruch)

Nie ma dowodów, że to zwiększa cytowania przez AI. Systemy AI wybierają źródła przez ranking wyszukiwarki (Google, Bing, Brave, własne indeksy), a nie przez instrukcje na stronie. Dla oceniającego człowieka (Quality Rater) i dla nauczyciela takie bloki wyglądają jak SEO-spam i obniżają zaufanie oraz konwersję.

### 4. Sygnał recenzenta, którego nie da się zweryfikować

„Reviewed by Martha, ESL Methodology Reviewer” widnieje na 179 stronach, w tym na 79 identycznych szablonach. Profil `/authors/martha` podaje tylko imię i „10 years of ESL experience”: brak nazwiska, zdjęcia, linków i weryfikowalnych kwalifikacji. Jeśli Martha nie recenzowała realnie tych tekstów, to jest to mylący sygnał E-E-A-T (ryzyko polityki spamu i reputacji). **Decyzja właściciela**: albo pełna, prawdziwa tożsamość i realna recenzja wybranych stron, albo usunięcie podpisu.

### 5. Brak pętli zwrotnej (przyczyna źródłowa)

- Fetch GSC API nigdy nie zadziałał (brak tokena), URL Inspection został pominięty, a baseline AI ma **0 wypełnionych odpowiedzi** (Status: manual-template).
- Wewnętrzne audyty (Martha Test, x1000 completion: „38 passed, 0 failures”, brak sierot w grafie linków) mierzyły **zgodność z planem, a nie efekt**. Plan mógł być w 100% „zielony”, a ruch stać w miejscu (prawo Goodharta).
- Poprzedni flow promptów bez danych działał w trybie „CODE-ONLY”, a jego macierz luk naturalnie kończyła się wnioskiem „brakuje URL → stwórz stronę”. Tak powstała maszyna do produkcji stron.

### 6. Problemy techniczne (średnie)

- **Soft 404**: każdy nieistniejący URL zwraca `200` z HTML strony głównej (sprawdzone: `/this-page-does-not-exist-xyz` → 200). Stare przekierowania działają jako stuby `noindex` zamiast `301`, a 11 tras ma `fail-no-signal`. Przyczyna: Worker Cloudflare z `wrangler.toml` nie obsługuje domeny produkcyjnej.
- **Niespójny opis encji**: `external-evidence-playbook.md` opisuje Edooqoo jako „platform … to generate, organize, assign, reuse…”, a `llms.txt` jako „lesson-preparation system for … recurring one-to-one lessons with adult learners”. Dla GEO liczy się, żeby w całym webie powtarzał się ten sam opis.
- **Bing**: brak śladu Bing Webmaster Tools i IndexNow. ChatGPT search opiera się m.in. na indeksie Bing, więc to tani i pominięty kanał GEO.

---

## Rekomendacje (do decyzji, kolejność wg wpływu/ryzyka)

| # | Ruch | Dlaczego | Kto |
|---|---|---|---|
| 0 | **Sprawdź teraz w GSC**: wykres wyświetleń wokół 18–21.08.2026 i marca 2026; Ręczne działania; Strony → zindeksowane vs niezindeksowane dziś | Rozstrzyga, czy democja już nastąpiła | człowiek, 10 min |
| 1 | **Przycinanie**: `noindex` i usunięcie z sitemap (lub scalenie z 301 tam, gdzie hosting pozwala) stron szablonowych, które nie miały wyświetleń w GSC przez ostatnie 3 miesiące. Najpierw 79 identycznych „reframed”, potem trójki zawodów (1 strona na zawód), potem klaster „AI alternative” (scalić do ~3 mocnych stron) | Usuwa sygnał scaled content dla całego serwisu, a crawl trafia na strony, które warto indeksować | generator + decyzja |
| 2 | **Usunąć widoczne bloki dla botów** („When to cite”, „Primary audience”, „RAG Keywords”, blok 60 linków). Zostawić to, co służy ludziom: odpowiedź na początku, tabele, FAQ, 5–10 kontekstowych linków | Sygnał jakości dla Google, zaufanie i konwersja nauczyciela | generatory |
| 3 | **Martha**: prawdziwa tożsamość + realna recenzja albo usunięcie podpisu | Ryzyko mylącego E-E-A-T | decyzja |
| 4 | **Prawdziwe przykłady na stronach pSEO**: na 95 indeksowalnych stronach `/worksheets` i `/esl-worksheets` pokazać realny, wygenerowany i sprawdzony przez nauczyciela arkusz (podgląd + klucz odpowiedzi), wytworzony zwykłym flow aplikacji, bez zmian w silniku | Trafia w intencję i daje unikalną wartość, której konkurenci z bibliotekami mają dużo, a Edooqoo dziś nie pokazuje | generator + treść |
| 5 | **Off-site GEO** (największa dźwignia AI): Bing Webmaster Tools + IndexNow; obecność w zewnętrznych zestawieniach „best AI tools for ESL teachers/tutors”; autentyczny udział w r/TEFL, r/ESL_Teachers, grupach FB nauczycieli; demo na YouTube; katalogi AI/EdTech; jeden spójny opis encji wszędzie | Badania 2026: wzmianki o marce korelują z widocznością w AI Overviews ok. 3× silniej niż backlinki; Perplexity najczęściej cytuje Reddit, ChatGPT treści encyklopedyczne | człowiek |
| 6 | **Pomiar efektu**: token GSC dla `seo:fetch-gsc-performance`, stały panel 30 zapytań × 4 silniki raz w miesiącu, rejestracje z ruchu organicznego i referral z `chatgpt.com` / `perplexity.ai` | Bez tego nie wiadomo, co działa | człowiek + skrypty |

Czego **nie** robić: nie tworzyć nowych stron, dopóki 1–2 nie są zrobione; nie przepisywać szablonów innymi słowami (parafraza nadal jest scaled content); nie usuwać stron, które mają wyświetlenia.

Nowy miesięczny workflow: `docs/seo/monthly-workflow.md`.

## Źródła zewnętrzne

- [Scaled Content Abuse: Google's March update](https://www.digitalapplied.com/blog/scaled-content-abuse-google-march-update-ai-pages-decimated)
- [Google August 2026 Spam Update: scaled AI content](https://kurums.com/googles-august-2026-spam-update-targeted-scaled-ai-content-what-marketing-teams-must-fix-now/)
- [Google's Scaled Content Abuse Policy in 2026](https://postforsuccess.com/scaled-content-abuse)
- [State of AI citations 2026](https://www.5wpr.com/research/state-of-ai-citations-2026/)
- [Generative Engine Optimization Statistics (2026)](https://www.omnibound.ai/blog/generative-engine-optimization-statistics)
- [How Reddit affects AI visibility in 2026](https://quickseo.ai/blog/how-reddit-affects-ai-visibility-2026)
