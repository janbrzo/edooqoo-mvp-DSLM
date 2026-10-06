# Dostęp do Search Console API (konto serwisowe, tylko odczyt)

Po tej konfiguracji `npm run seo:fetch-gsc-performance` i `npm run seo:inspect-gsc-sample` same pobierają dane z GSC (w tym zestawienia strona × zapytanie), bez ręcznych eksportów. Prompt 0 z `docs/seo/monthly-workflow.md` z nich korzysta.

Skrypty wyniki zapisują w `docs/seo/runs/gsc-performance/` i `docs/seo/runs/url-inspection/`. Bez poświadczeń kończą się statusem `skipped` z powodem, nie awarią.

## Kroki (jednorazowo, ok. 15 minut)

1. **Projekt i API.** Wejdź na https://console.cloud.google.com, utwórz projekt (np. `edooqoo-seo`) albo wybierz istniejący. W menu **APIs & Services → Library** wyszukaj **Google Search Console API** i kliknij **Enable**.
2. **Konto serwisowe.** **IAM & Admin → Service Accounts → Create service account**. Nazwa np. `gsc-reader`. Role w Google Cloud nie są potrzebne, pomiń je.
3. **Klucz.** Otwórz utworzone konto → zakładka **Keys → Add key → Create new key → JSON**. Pobierze się plik `.json`. (Jeśli opcja jest zablokowana, organizacja Google Cloud ma włączoną politykę `iam.disableServiceAccountKeyCreation`; zmienia ją administrator organizacji.)
4. **Skopiuj adres e-mail konta** (`…@…iam.gserviceaccount.com`).
5. **Dostęp w Search Console.** https://search.google.com/search-console → wybierz usługę `edooqoo.com` → **Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika** → wklej adres e-mail konta serwisowego → uprawnienie **Ograniczone** (tylko odczyt) → **Dodaj**.
6. **Sekret w środowisku.** Zawartość pliku JSON (cały plik) wklej jako wartość zmiennej `GSC_SERVICE_ACCOUNT_JSON`:
   - w środowisku Claude Code: menu środowiska chmurowego w pasku tytułowym sesji → **Edit** → sekcja z poświadczeniami API lub zmienne środowiskowe. Nowa sesja je odczyta;
   - w GitHub (miesięczny workflow `seo-monitoring.yml`): **Settings → Secrets and variables → Actions → New repository secret** o nazwie `GSC_SERVICE_ACCOUNT_JSON`.
7. **Sieć.** W tym samym oknie środowiska sprawdź **Network access**. Jeśli to tryb ograniczony, dodaj `oauth2.googleapis.com` i `www.googleapis.com`.
8. **Usuń pobrany plik `.json`** z komputera, gdy sekret jest już zapisany.
9. **Test:** `npm run seo:fetch-gsc-performance`. Powinien zapisać plik ze statusem `ok` (a nie `skipped`).

Nie wklejaj klucza na czat ani do repozytorium.

## Ważne

- Właściwość w GSC musi być tą, której adres podano w `GSC_SITE_URL`. Domyślnie `sc-domain:edooqoo.com` (usługa domenowa). Jeśli masz usługę z prefiksem URL, ustaw `GSC_SITE_URL=https://edooqoo.com/`.
- Dane w API są dostępne z opóźnieniem 2–3 dni i obejmują do 16 miesięcy.
- Anonimizowane zapytania nie pojawiają się w wynikach (tak samo jak w interfejsie).
- Uprawnienie „Ograniczone” nie pozwala zmieniać ustawień ani wysyłać map witryny. Dostęp cofniesz, usuwając użytkownika w GSC albo klucz w Google Cloud.

## Jak to działa (dla kodu)

`scripts/seo/seo-monitoring-utils.mjs`: `resolveBearerToken()` najpierw używa gotowego tokenu (`GSC_ACCESS_TOKEN`, `GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN`, `GOOGLE_ACCESS_TOKEN`), a gdy go nie ma, podpisuje krótkotrwały JWT (RS256, zakres `webmasters.readonly`) kluczem z `GSC_SERVICE_ACCOUNT_JSON` i wymienia go na token dostępu w Google. Klucz nie jest nigdzie logowany, a komunikaty błędów go nie zawierają. Testy: `scripts/seo/__tests__/gsc-auth.test.mjs`.
