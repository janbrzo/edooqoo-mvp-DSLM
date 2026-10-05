# Audyt kierunku SEO/GEO, 2026-10-04

Zakres: czy dotychczasowa praca nad SEO/GEO szła w dobrą stronę i czy coś szkodzi. Ten audyt niczego nie zmienia na stronie. Każda zmiana z sekcji „Rekomendacje” wymaga decyzji właściciela.

Źródła: aktualny checkout `main` (commit `0ee806c`), `docs/seo/*` (eksport GSC z 2026-06-23, baseline GSC z 2026-08-16, live-routing z 2026-08-24), odpytanie produkcji `edooqoo.com` (2026-10-04) oraz nowy pomiar `npm run seo:audit-uniqueness` (`docs/seo/content-uniqueness.generated.md`).

Aktualizacja tego samego dnia: właściciel dostarczył eksporty GSC (Skuteczność za 3 miesiące 2026-06-30 → 2026-09-29, Indeksowanie stron, Breadcrumbs, HTTPS). Sprawdziłem też na produkcji każdy URL z eksportu. Pełny pakiet danych: `docs/seo/runs/monthly/2026-10.md`. Sekcje poniżej uwzględniają te dane; tam, gdzie zmieniły wcześniejszy wniosek, jest to zaznaczone.

---

## Werdykt

1. **Strategia produktu jest dobra, strategia treści się nie sprawdziła.** Około 200 stron zbudowanych pod tę strategię dało w 3 miesiące 15 kliknięć: 45 stron „AI/ChatGPT alternative” → 1 kliknięcie, 51 stron zawodowych → 0, 13 stron what-to-teach-next → 0, 95 stron pSEO → 14.
2. **Ruch robią rzeczy unikalne i użyteczne.** 12 URL-i (5 darmowych narzędzi + 7 stron funkcji) dało 42 kliknięcia; `/tools/vocab-cefr-checker` to strona nr 1 w całym serwisie. Do tego unikalne artykuły dla nauczycieli i strony gramatyczne z arkuszami.
3. **Nie było nagłego spadku po sierpniowym spam update.** Jest powolna erozja: liczba zindeksowanych stron spadła z 622 do 559 (−10% od lipca), a „zeskanowana, niezindeksowana” wzrosła z 27 do 128. Google crawluje strony i coraz częściej ich nie przyjmuje. 65% indeksowalnych stron jest szablonowych (358 z 550), więc to wciąż największe ryzyko, ale nie ma pożaru.
4. **Nowy, najpilniejszy problem: 38 URL-i, które w ostatnich 3 miesiącach dały 34 kliknięcia i 1042 wyświetlenia, zwraca dziś 404**, bez przekierowania. To 11% wszystkich kliknięć serwisu.
5. **Zapytania z ICP praktycznie nie istnieją w GSC**: „tutor” → 2 wyświetlenia, a „private”, „adult”, „business english”, „chatgpt” → 0. Ruch z Google to nauczyciele ESL szukający ćwiczeń, narzędzi CEFR i arkuszy. Marka: „edooqoo” → 5 wyświetleń.

## Co działa: zostawić

| Element | Dowód |
|---|---|
| Pozycjonowanie i ICP | spójne w `llms.txt`, `docs/llm-context.md`, stronach `/features/*` |
| Prerender tras SPA | produkcja: `/pricing` 724 słowa w HTML, `/about` 2478, poprawne canonicale |
| Polityka indeksacji pSEO | 1330 kombinacji `noindex`, 95 indeksowalnych (`pseo-index-policy.generated.json`) |
| robots.txt | prywatne trasy wyłączone, boty AI nie są blokowane |
| Unikalne strony | `/features/*`, `/what-to-teach-next/*`, `/tools/*`: 0% szablonowości |
| Strony, które realnie zbierają ruch | `/blog/teaching-english-intonation-stress` (309 wyśw.), `/modal-verbs-worksheets-esl` (poz. 7.7), `/blog/teaching-collocations-esl`, wszystkie unikalne (podobieństwo do innych stron ≈1%) |
| `llms.txt` | dobrze napisany, z granicami claimów. Tani w utrzymaniu, ale nie oczekiwać mierzalnego efektu; Google go nie używa |

---

## Co szkodzi: dowody

### 1. Treści generowane masowo z szablonu (scaled content): ryzyko krytyczne

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

> **Korekta po danych z 2026-10-04**: „wykryta, niezindeksowana” spadła z 1000+ do 143, a „zeskanowana, niezindeksowana” wzrosła z 27 do 128. Google crawluje już prawie wszystko, ale coraz częściej odrzuca strony po przeczytaniu. Wniosek o niskiej ocenie jakości stoi; jego mechanizm się zmienił.

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

- **Soft 404** (downgraded 2026-10-05: unknown paths with a file extension return a real 404, and the SPA `NotFound` page already sets `noindex`; moving hosting to Cloudflare only for this is not recommended, see `docs/seo/off-site-and-infra-runbook.md`): każdy nieistniejący URL zwraca `200` z HTML strony głównej (sprawdzone: `/this-page-does-not-exist-xyz` → 200). Stare przekierowania działają jako stuby `noindex` zamiast `301`, a 11 tras ma `fail-no-signal`. Przyczyna: Worker Cloudflare z `wrangler.toml` nie obsługuje domeny produkcyjnej.
- **Niespójny opis encji**: `external-evidence-playbook.md` opisuje Edooqoo jako „platform … to generate, organize, assign, reuse…”, a `llms.txt` jako „lesson-preparation system for … recurring one-to-one lessons with adult learners”. Dla GEO liczy się, żeby w całym webie powtarzał się ten sam opis.
- **Bing**: brak śladu Bing Webmaster Tools i IndexNow. ChatGPT search opiera się m.in. na indeksie Bing, więc to tani i pominięty kanał GEO.

---

## Rekomendacje po danych GSC (do decyzji, kolejność wg wpływu/ryzyka)

| # | Ruch | Dowód | Kto |
|---|---|---|---|
| 1 | **Naprawić 38 URL-i z 404**, które mają wyświetlenia: przekierować każdy do najbliższej żywej strony (np. `/blog/modal-verbs-exercises-esl-guide.html` → `/modal-verbs-worksheets-esl.html`) albo odtworzyć treść | 34 kliknięcia i 1042 wyświetlenia tracone teraz; zerowe ryzyko | generator przekierowań, 1 PR |
| 2 | **Wzmocnić to, co działa**: narzędzia `/tools/*` i `/features/placement-test`. `cefr level checker` ma 94 wyświetlenia na poz. 26.6, `cefr writing checker` poz. 25.8: dopracować tytuł, H1 i treść narzędzia, linki z bloga, ścieżkę narzędzie → rejestracja | Narzędzia mają 98 wyśw./stronę vs 3–6 dla stron strategicznych i przyciągają nauczycieli z realną potrzebą | kod + treść |
| 3 | **Przycinanie oparte na danych**: `noindex` + usunięcie z sitemap dla 296 stron szablonowych z < 10 wyświetleniami (128 blog, 84 root, 46 `/worksheets`, 31 `/esl-worksheets`, 7 `/english-for`). Trójki zawodowe → 1 strona na zawód albo usunięcie; klaster „AI alternative” → ~3 strony. **Wyjątek: 53 z 79 identycznych „reframed”** mają wyświetlenia (URL-e niosą historię sprzed podmiany treści). Te przepisać do realnej, unikalnej treści, nie wyłączać | Szablony: 7,2 wyśw./stronę vs 29 dla unikalnych; rośnie „zeskanowana, niezindeksowana” | generator + decyzja |
| 4 | **Usunąć widoczne bloki dla botów** („When to cite”, „Primary audience”, „RAG Keywords”, blok 60 linków) | Strony z nimi nie dostają ruchu; strony, które go dostają, ich nie mają | generatory |
| 5 | **Promować pSEO, które zarabia**: 19 tras `noindex` z kliknięciami (np. `/esl-worksheets/news-media/c1-advanced`: 14 kliknięć, poz. 6.9) przenieść do zestawu indeksowalnego + prerender, a polityka indeksacji ma odtąd korzystać z danych GSC | Polityka wyłączyła stronę nr 5 w serwisie; w surowym HTML ma canonical na `/` | generator polityki |
| 6 | **Prawdziwe arkusze na stronach arkuszy**: na indeksowalnych `/worksheets` i `/esl-worksheets` pokazać realny arkusz z aplikacji (podgląd + klucz), bez zmian w silniku | Publiczne strony galerii `/gallery/*` z prawdziwymi arkuszami dostają kliknięcia, a opisowe strony pSEO 3,4 wyśw./stronę | generator + treść |
| 7 | **Martha**: prawdziwa tożsamość + realna recenzja albo usunięcie podpisu | Ryzyko mylącego E-E-A-T | decyzja |
| 8 | **Off-site + marka**: Bing Webmaster Tools + IndexNow; zestawienia „best AI tools for ESL teachers”; Reddit/FB (autentycznie); demo na YouTube; katalogi; jeden opis encji | Popyt na markę ≈ 0 („edooqoo” 5 wyśw.), a to najsilniejszy predyktor rekomendacji przez AI | człowiek |
| 9 | **Decyzja strategiczna o ICP w treściach** (tylko człowiek): produkt zostaje dla tutorów 1:1 dorosłych, ale treści top-of-funnel obsługują szerszą grupę nauczycieli ESL, którzy już przychodzą (ćwiczenia, CEFR, gramatyka), i kierują ich do narzędzi i produktu | Zapytania z ICP mają ~0 wyświetleń; ruch to ogólni nauczyciele ESL | decyzja |
| 10 | **Pomiar**: token GSC dla `seo:fetch-gsc-performance`, panel 30 zapytań × 4 silniki, rejestracje wg źródła, referral z `chatgpt.com` / `perplexity.ai` | Bez tego retro nie zadziała | człowiek + skrypty |

Czego **nie** robić: nie tworzyć nowych stron, dopóki 1–5 nie są zrobione; nie przepisywać szablonów innymi słowami (parafraza nadal jest scaled content); nie usuwać stron, które mają wyświetlenia.

Nowy miesięczny workflow: `docs/seo/monthly-workflow.md`.

## Źródła zewnętrzne

- [Scaled Content Abuse: Google's March update](https://www.digitalapplied.com/blog/scaled-content-abuse-google-march-update-ai-pages-decimated)
- [Google August 2026 Spam Update: scaled AI content](https://kurums.com/googles-august-2026-spam-update-targeted-scaled-ai-content-what-marketing-teams-must-fix-now/)
- [Google's Scaled Content Abuse Policy in 2026](https://postforsuccess.com/scaled-content-abuse)
- [State of AI citations 2026](https://www.5wpr.com/research/state-of-ai-citations-2026/)
- [Generative Engine Optimization Statistics (2026)](https://www.omnibound.ai/blog/generative-engine-optimization-statistics)
- [How Reddit affects AI visibility in 2026](https://quickseo.ai/blog/how-reddit-affects-ai-visibility-2026)
