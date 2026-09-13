# M3 — Student Workspace: badanie UX dla StudentHeaderBar, StudentSnapshotPanel, StudentSettingsMenu

Kontekst w kodzie: `src/pages/StudentPage.tsx` — obecnie pasek 7 zakładek (`TabsList grid-cols-7`:
Overview, 1 MINUTE/DSLM, Worksheets, Homework, Flashcards, Calendar, Tests), a w zakładce
Overview karta „Student Details” z przyciskami Edit/Delete duplikuje dane, które pojawiają się
też w innych miejscach (DSLM profil, OneMinutePrepCard). M3 ma dostawić nowe komponenty
**obok** starych zakładek (bez ich usuwania), więc kluczowe jest: brak duplikacji treści,
jasna hierarchia akcji i responsywność przy dodaniu nowego paska/panelu nad istniejącym UI.

## 1. Nagłówek strony rekordu (StudentHeaderBar)

- Wzorce z systemów rekordów (ServiceNow Horizon, Blackbaud SKY UX, Infor) pokazują spójną
  anatomię: identyfikacja encji (nazwa, avatar/inicjały, status) + kluczowe pary
  etykieta-wartość + akcje, bez powtarzania treści z sekcji poniżej [1](https://horizon.servicenow.com/workspace/page-templates/record) [3](https://developer.blackbaud.com/skyux/design/guidelines/page-layouts/record-page?svcid=skyux-modern%3Bsvcid%3Dskyux-modern%3Bdocs-active-tab%3Ddesign) [2](https://design.infor.com/patterns/page-layouts/profile-record/).
- Reguła SKY UX: strony rekordu służą do agregowania informacji o obiekcie w jednym miejscu —
  jeśli da się przewidzieć akcje użytkownika, warto je wyeksponować bezpośrednio w nagłówku,
  zamiast chować w podstronach [3](https://developer.blackbaud.com/skyux/design/guidelines/page-layouts/record-page?svcid=skyux-modern%3Bsvcid%3Dskyux-modern%3Bdocs-active-tab%3Ddesign).
- Przełożenie na Edooqoo `/student/:id`:
  - `StudentHeaderBar` zastępuje/uzupełnia obecny prosty `Back` link w `StickyNav` — powinien
    zawierać: awatar/inicjały ucznia, imię i nazwisko, poziom (English level) jako badge,
    ewentualny status (np. „aktywny”, „intake w toku” — powiązać z istniejącym
    `IntakeExtractionBanner`), oraz **jedną** grupę akcji podstawowych (np. „Generuj arkusz”,
    „Edytuj”) — bez duplikowania przycisków Edit/Delete, które dziś są w karcie „Student
    Details” w zakładce Overview. Docelowo edycja/usuwanie przenoszą się do
    `StudentSettingsMenu`, a karta Overview przestaje mieć własne ikony akcji (redukcja
    duplikacji zidentyfikowanej w kodzie: dziś Edit/Delete istnieją tylko w Overview, co jest
    ryzykiem niespójności jeśli header też dostanie akcje — trzeba je scalić w jedno źródło
    prawdy, żeby przy montażu obok starych zakładek nie powstały dwa różne „Edit”).
  - Nagłówek montowany „przy starych zakładkach” = musi żyć nad `<Tabs>` w
    `StudentPage.tsx`, wspólny dla wszystkich 7 zakładek — dziś takiego wspólnego paska nie ma
    (dane studenta są tylko w Overview), więc to realna poprawa non-duplikacyjna: usunąć z
    Overview to, co przenosi się do nagłówka.

## 2. Boczny panel snapshot (StudentSnapshotPanel)

- Wzorzec „highlights panel” / „snapshot panel” (Salesforce Avonni, SugarCRM) pokazuje
  skondensowany zestaw najważniejszych pól rekordu w panelu bocznym lub tuż pod nagłówkiem —
  dostępny z każdej zakładki bez przechodzenia do Overview [6](https://docs.avonnicomponents.com/projects/dynamic-components/layout-and-interactions/build-a-custom-record-header-and-highlights-panel) [4](https://www.yathit.com/sugarcrm-gmail/create-record.html).
- Workday Canvas „Side Panel” — panel boczny jako kontener przypięty do krawędzi, z jasno
  zdefiniowanym trybem głównym vs. podglądowym (nie dublować głównej treści, panel ma
  uzupełniać, nie powielać) [7](https://canvas.workday.com/components/containers/side-panel/).
- Przełożenie na Edooqoo:
  - `StudentSnapshotPanel` zbiera to, co dziś jest rozrzucone po Overview + DSLM (cel nauki
    `main_goal`/`formatGoalLabel`, e-mail ucznia i link do `edooqoo.com/my`, link do spotkania
    `MeetingLinkField`, ostatnie notatki z `useStudentKnowledge`) — ale **tylko jako skrót z
    linkiem „zobacz więcej” do właściwej zakładki** (np. klik w notatki przełącza na zakładkę
    DSLM/profile), a nie kopię pełnej treści. To bezpośrednio adresuje ryzyko duplikacji przy
    dostawieniu panelu obok istniejącej karty „Student Details”.
  - Na desktopie: panel przypięty po prawej (lub lewej) stronie treści zakładek, sticky przy
    scrollu. Na mobile/tablet: panel zwija się do rozwijanej sekcji nad zakładkami lub do
    drawer/bottom sheet — zgodnie z powszechnym wzorcem collapse sidebar → drawer poniżej
    breakpointu [8](https://asoasis.tech/articles/2026-05-22-0838-react-collapsible-sidebar-navigation/) [10](http://uianatomy.dev/components/sidebar-nav).
  - Dostępność: panel jako `<aside>`/landmark z `aria-label="Podsumowanie ucznia"`, przycisk
    zwijania z `aria-expanded`, focus trap tylko gdy panel działa jako drawer na mobile.

## 3. Progressive disclosure i menu ustawień (StudentSettingsMenu)

- Nielsen/NN-g: progressive disclosure odkłada zaawansowane/rzadko używane funkcje na drugi
  plan, dzięki czemu główny ekran jest prostszy i mniej podatny na błędy — kluczowe kryterium:
  na pierwszym planie tylko akcje częste, reszta w menu drugorzędnym [11](https://www.nngroup.com/articles/progressive-disclosure/).
  Zasada GitHub Primer: disclosure nie powinno gubić kontekstu użytkownika (np. otwarcie menu
  nie chowa danych, na których użytkownik pracował) [12](https://primer.github.io/design/ui-patterns/progressive-disclosure/).
  Enterprise settings patterns: grupować opcje logicznie (encja/konto/uprawnienia), nie
  dodawać nowych opcji płasko do rosnącej listy [13](https://setting.page/enterprise-admin-settings-patterns).
- Przełożenie na Edooqoo:
  - `StudentSettingsMenu` = ikona „kebab”/koło zębate w `StudentHeaderBar`, kryjąca akcje
    rzadsze/ryzykowne: Edytuj dane ucznia (dziś `StudentEditDialog`), Udostępnij/kalendarz
    (`teacherCalendarToken`, `gcalEnabled` — dziś rozproszone w logice strony), Usuń ucznia
    (dziś `AlertDialog` z podwójnym potwierdzeniem — **zostawić** wzorzec „wpisz nazwę, by
    potwierdzić”, to dobra praktyka destrukcyjnej akcji, tylko przenieść wyzwalacz z Overview
    do menu ustawień).
  - Hierarchia akcji: przycisk główny/pierwszoplanowy w headerze (np. „Generuj arkusz” —
    najczęstsza czynność nauczyciela) jako primary button, akcje drugorzędne (edycja
    metadanych) jako secondary/ghost, akcje rzadkie i destrukcyjne (usuń) tylko w overflow
    menu — zgodnie z ogólną zasadą button hierarchy i wzorcem „primary action w wizardach,
    destrukcyjne działania nie jako primary” [9](https://subux.pro/guides/article/button-hierarchy-primary-secondary-tertiary) [14](https://www.patternfly.org/components/button/design-guidelines/) [16](https://design.infor.com/patterns/interactions/button-group/).
  - Uwaga o kontekście (Primer): otwarcie `StudentSettingsMenu` nie może przełączać
    aktywnej zakładki ani gubić stanu formularza w bieżącej zakładce [12](https://primer.github.io/design/ui-patterns/progressive-disclosure/).

## 4. Hierarchia działań na całej stronie

- Skonsolidować: dziś akcje na tej samej encji (Edit ucznia, Delete ucznia, Generate
  worksheet, Add Note, Share) są rozsiane pomiędzy `StickyNav`, kartę Overview i wnętrza
  poszczególnych zakładek. M3 powinno zdefiniować jedno miejsce „prawdy” dla akcji na
  poziomie encji: primary w `StudentHeaderBar`, drugorzędne/rzadkie w `StudentSettingsMenu`,
  a akcje kontekstowe (per zakładka, np. „Usuń arkusz”) zostają lokalnie w zakładkach — nic
  nie dubluje się między poziomami.
- Rekomendacja z wzorców button-group: max. 1 primary + 1-2 secondary widoczne stale, reszta
  w menu — redukuje szum wizualny i ryzyko przypadkowego kliknięcia akcji destrukcyjnej
  [16](https://design.infor.com/patterns/interactions/button-group/).

## 5. Responsywność

- Obecny `TabsList grid-cols-7` już dziś chowa etykiety poniżej `lg:` (tylko ikony) — to
  dobra baza, ale przy dodaniu `StudentHeaderBar` + `StudentSnapshotPanel` trzeba
  zaprojektować układ mobile jako stos pionowy: Header (skrócony) → Snapshot (zwinięty,
  rozwijany) → Tabs → treść, z priorytetem dla treści zakładki na małych ekranach
  [8](https://asoasis.tech/articles/2026-05-22-0838-react-collapsible-sidebar-navigation/) [10](http://uianatomy.dev/components/sidebar-nav).
- Side panel wzorem Workday Canvas: variant „Main” (pełny, desktop) vs. skrócony/„Preview”
  na mniejszych ekranach zamiast chowania całkowicie — pokazuje minimalny zestaw danych,
  reszta w drawerze [7](https://canvas.workday.com/components/containers/side-panel/).

## 6. Dostępność (WCAG)

- Header, snapshot panel i menu ustawień jako oddzielne landmarki ARIA (`banner`/`heading`
  dla header, `complementary`/`aside` dla snapshot, `menu`/`dialog` dla ustawień), pełna
  obsługa klawiatury (Tab/Shift+Tab, Esc zamyka menu/drawer, focus wraca do triggera po
  zamknięciu) — zgodnie z rekomendacjami budowy dostępnego, responsywnego panelu bocznego w
  React (ARIA + keyboard support + persisted state) [8](https://asoasis.tech/articles/2026-05-22-0838-react-collapsible-sidebar-navigation/).
- Kontrast i target size przycisków w headerze/menu ustawień — zachować min. 44×44px na
  triggerach mobile (kebab menu), zgodnie z ogólnymi wytycznymi menu/actions Apple HIG (akcje
  jednoznaczne, natychmiastowe, czytelne etykiety) [15](https://developer-rno.apple.com/design/human-interface-guidelines/components/menus-and-actions/buttons).

## 7. Unikanie duplikacji informacji — checklist wdrożeniowy dla M3

1. Po dodaniu `StudentHeaderBar`: usunąć nazwę/awatar/status ucznia z karty „Student Details”
   w Overview (zostają tam tylko pola szczegółowe, nieobecne w headerze).
2. Po dodaniu `StudentSettingsMenu`: przenieść trigger Edit (`setIsEditDialogOpen`) i Delete
   (`AlertDialog` z potwierdzeniem nazwą) z karty Overview do menu w headerze; karta Overview
   przestaje renderować własne przyciski akcji.
3. `StudentSnapshotPanel` pokazuje wyłącznie skróty (1 linia / badge) z linkiem do pełnej
   sekcji w odpowiedniej zakładce (DSLM profile, Calendar, Knowledge) — żadna dana nie jest
   w pełni redagowalna z poziomu panelu w M3 (edycja zostaje w dotychczasowych miejscach,
   np. `StudentEditDialog`, `MeetingLinkField`), by nie powielać logiki formularzy.
4. Zachować istniejące zakładki bez zmian funkcjonalnych w M3 — komponenty montowane są
   „obok” (nad `<Tabs>`), a redukcja duplikacji dotyczy tylko przeniesienia (nie kopiowania)
   elementów z Overview do headera/menu.

## Źródła
1. ServiceNow Horizon — Record page template: https://horizon.servicenow.com/workspace/page-templates/record
2. Infor Design System — Profile Record: https://design.infor.com/patterns/page-layouts/profile-record/
3. Blackbaud SKY UX — Record page: https://developer.blackbaud.com/skyux/design/guidelines/page-layouts/record-page
4. Yathit — SugarCRM snapshot panel: https://www.yathit.com/sugarcrm-gmail/create-record.html
6. Avonni — Custom Record Header & Highlights Panel: https://docs.avonnicomponents.com/projects/dynamic-components/layout-and-interactions/build-a-custom-record-header-and-highlights-panel
7. Workday Canvas — Side Panel: https://canvas.workday.com/components/containers/side-panel/
8. ASOasis — Accessible responsive React collapsible sidebar: https://asoasis.tech/articles/2026-05-22-0838-react-collapsible-sidebar-navigation/
9. SubUX — Button hierarchy: https://subux.pro/guides/article/button-hierarchy-primary-secondary-tertiary
10. uianatomy.dev — Sidebar Nav: http://uianatomy.dev/components/sidebar-nav
11. NN/g — Progressive Disclosure (Nielsen): https://www.nngroup.com/articles/progressive-disclosure/
12. GitHub Primer — Progressive disclosure: https://primer.github.io/design/ui-patterns/progressive-disclosure/
13. setting.page — Enterprise Admin Settings Patterns: https://setting.page/enterprise-admin-settings-patterns
14. PatternFly — Button design guidelines: https://www.patternfly.org/components/button/design-guidelines/
15. Apple HIG — Buttons (menus and actions): https://developer-rno.apple.com/design/human-interface-guidelines/components/menus-and-actions/buttons
16. Infor Design System — Button Group: https://design.infor.com/patterns/interactions/button-group/
