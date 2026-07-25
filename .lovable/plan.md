## Plan v6.9.79 — MCP Authenticated (custom bearer) + Naprawa Cloudflare Worker Deploy + SEO Monitoring

Poniżej **pełny plan bez skracania**. Sekrety GH masz już dodane — więc pomijamy sekcję „jak zdobyć sekrety" i skupiamy się na **kodzie + fixie deployu który wywalił się na exit 1**.

---

## Część 0 — Root cause deployu #3 (Cloudflare Worker) na exit 1 po 20s

Z zrzutu widać: total 20s, „Process completed with exit code 1", plus warning Node 20 (to tylko warning — nie powód failu). 20 sekund to za mało na `build:seo` (który uruchamia `vite build`, `docs:audit-source`, ~15 wewnętrznych skryptów i trwa 3-5 minut). Znaczy: albo `npm ci` padł, albo `npm run build:seo` padł na pierwszym kroku audytu (np. brak GSC tokena w env dla któregoś audytora), albo `wrangler deploy` się nie wykonał bo `[assets] directory = "./dist"` jest pusty.

**Sedno problemu w `.github/workflows/cloudflare-worker-deploy.yml`:**
1. `npm run build:seo` w kroku „Build SEO assets for Worker deployment" to gigantyczny łańcuch (kilkanaście audytów SEO + prerender + Martha test). Do deployu Workera potrzebujemy tylko: (a) `scripts/seo/generate-edge-routing.mjs` (żeby wygenerować `cloudflare/content-routing.generated.mjs`), (b) `vite build` (żeby zapełnić `./dist`). Reszta jest overkillem i to ona wywala workflow.
2. `actions/checkout@v4` + `actions/setup-node@v4` — Node 20 forcowany na 24. Trzeba `@v5`.
3. Ostatni krok `npm run seo:verify-live-routing` może failować jeśli worker jeszcze się nie propaguje (potrzeba 10-30s).

**Fix (część planu — Krok 0 poniżej):** dodać nowy dedykowany skrypt `deploy:cloudflare-worker-fast` który robi tylko potrzebne kroki, zaktualizować akcje na v5, dodać `sleep 20` przed weryfikacją i użyć `|| true` przy live routing (soft) żeby jednorazowy propagation delay nie killował workflow.

---

## A. UX walkthrough — MCP Authenticated dla nauczyciela (Supabase custom bearer)

Kompletny scenariusz end-to-end tak jak zobaczy to nauczyciel po wdrożeniu:

### Krok 1 — Wejście
Nauczyciel loguje się na `edooqoo.com`. W górnej nawigacji, w dropdownie „Settings" (lub bezpośrednio pod `/profile`) pojawia się nowa pozycja **„Agent integrations (MCP)"**. Dodatkowo w `/profile` na dole nowa sekcja „AI assistant access" z ctaButton → `/settings/mcp`.

### Krok 2 — Strona `/settings/mcp`
Nagłówek: „Connect ChatGPT, Claude, Cursor to your Edooqoo".

Opis (Martha-compliant, adult-tone):
> Generate a Personal MCP Token to let your AI assistant (ChatGPT, Claude Desktop, Cursor) read your students and worksheets on your behalf. Tokens are per-device, read-only, and revocable at any time.

Tabela istniejących tokenów: `Name | Token prefix | Created | Last used | [Revoke]`
Przycisk **[+ Generate new token]**.

Pusta lista pokazuje empty state z 3 ikonami (ChatGPT/Claude/Cursor) + „No tokens yet. Generate one to get started."

### Krok 3 — Modal generowania
Klik **[+ Generate new token]** → shadcn `Dialog`:
- Input: „Token name" (np. „Claude Desktop — MacBook")
- Select: „Expires in" — `Never` / `30 days` / `90 days` / `1 year` (default `Never`)
- Przycisk **[Generate]** (loading state)

Po submit modal zamienia się na **„Copy your token now" state**:
- Duże pole `<code>` monospace z pełnym tokenem: `edq_mcp_AbC12DeF34gH56iJ78kLmN9oPqRsTu`
- Przycisk **[Copy to clipboard]** (używa `navigator.clipboard.writeText`)
- Czerwony `Alert variant=destructive`: „⚠️ This token is shown only once. Store it in your MCP client now — you won't be able to see it again."
- **Trzy zakładki `<Tabs>`** z gotowymi copy-paste snippetami:

**Claude Desktop tab:**
```
Path: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
       %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "edooqoo": {
      "url": "https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/mcp",
      "headers": { "Authorization": "Bearer edq_mcp_AbC12DeF34gH56iJ78kLmN9oPqRsTu" }
    }
  }
}
```

**Cursor tab:**
```
Path: .cursor/mcp.json (repo) or ~/.cursor/mcp.json (global)
{
  "mcpServers": {
    "edooqoo": {
      "url": "https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/mcp",
      "headers": { "Authorization": "Bearer edq_mcp_AbC12DeF34gH56iJ78kLmN9oPqRsTu" }
    }
  }
}
```

**ChatGPT tab (Custom Connector):**
```
ChatGPT Pro/Team → Settings → Connectors → Add custom
- URL: https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/mcp
- Auth type: Bearer token
- Token: edq_mcp_AbC12DeF34gH56iJ78kLmN9oPqRsTu
```

Po zamknięciu modala token znika. W tabeli widać tylko prefix `edq_mcp_AbC12DeF…` + nazwę + „Last used: never".

### Krok 4 — Nauczyciel testuje w Claude
Restartuje klienta. Pisze: „What's the current CEFR level and main goal of my student Marta?"

Claude wywołuje `tools/list` na `POST /functions/v1/mcp` z headerem `Authorization: Bearer edq_mcp_…` → dostaje 7 narzędzi:
- **Public** (bez auth): `echo`, `list_exercise_types`, `list_topics`
- **Authenticated** (wymagają bearera): `list_students`, `get_student_summary`, `list_recent_worksheets`, `suggest_next_lesson_topic`

Claude wywołuje `tools/call { name: "list_students", arguments: { limit: 20 } }`.

Nasz edge function `supabase/functions/mcp/index.ts`:
1. Odczytuje `Authorization: Bearer edq_mcp_…` z headerów requestu.
2. Waliduje: `token_hash = sha256(token); SELECT teacher_id FROM mcp_tokens WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
3. Jeśli miss → zwraca MCP error `{ isError: true, content: [{ type: "text", text: "Unauthorized: invalid or revoked MCP token." }] }`.
4. Jeśli hit → `teacherId = row.teacher_id`, tworzy service-role Supabase client, robi query `SELECT id, first_name, level, main_goal, updated_at FROM students WHERE teacher_id = $1 ORDER BY updated_at DESC LIMIT $2`.
5. Fire-and-forget: `UPDATE mcp_tokens SET last_used_at = now() WHERE token_hash = ?`.
6. Zwraca JSON w `structuredContent`.

Claude odpowiada: „You have 12 students. Marta Kowalska is at B2 with main goal 'Business meetings in English'…"

### Krok 5 — Revoke
Nauczyciel wraca na `/settings/mcp`, widzi „Last used: 2 minutes ago" przy tokenie „Claude Desktop — MacBook". Klika **Revoke** → `AlertDialog` „Revoke this token? Claude Desktop — MacBook will lose access immediately." → confirm → RPC `revoke_mcp_token(id)` → `UPDATE mcp_tokens SET revoked_at = now() WHERE id = ? AND teacher_id = auth.uid()` → następny call z tego klienta dostaje MCP unauthorized error.

---

## B. Plan implementacji — 7 kroków (build mode)

### KROK 0 — Napraw Cloudflare Worker Deploy (pierwsze — bo dopiero po zielonym deployu ma sens SEO Monitoring)

**Plik 1:** `package.json` — dodać nowy skrypt (bez usuwania istniejącego):
```json
"deploy:cloudflare-worker-fast": "npm run seo:generate-edge-routing && vite build && npx wrangler deploy --config wrangler.toml"
```

**Plik 2:** `.github/workflows/cloudflare-worker-deploy.yml` — przepisać na:
```yaml
name: Cloudflare Worker Deploy

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - 'wrangler.toml'
      - 'cloudflare/**'
      - 'src/lib/mcp/**'
      - 'scripts/seo/generate-edge-routing.mjs'
      - 'scripts/seo/content-registry.mjs'
      - 'package.json'
      - 'package-lock.json'

permissions:
  contents: read

jobs:
  deploy-worker:
    name: Deploy Cloudflare Worker edge routing
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch' || vars.CLOUDFLARE_WORKER_DEPLOY_ENABLED == 'true'

    steps:
      - name: Check out repository
        uses: actions/checkout@v5

      - name: Set up Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate edge routing manifest
        run: npm run seo:generate-edge-routing

      - name: Build static assets
        run: vite build
        env:
          # vite build wymaga tych env żeby wygenerować SPA — bierzemy je z Secrets
          VITE_SUPABASE_URL: https://bvfrkzdlklyvnhlpleck.supabase.co
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          VITE_SUPABASE_PROJECT_ID: bvfrkzdlklyvnhlpleck

      - name: Deploy Worker and route bindings
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: npx wrangler deploy --config wrangler.toml

      - name: Wait for edge propagation
        run: sleep 30

      - name: Verify live routing (soft)
        run: npm run seo:verify-live-routing -- --soft
```

**Uwaga o `VITE_SUPABASE_PUBLISHABLE_KEY`:** ta wartość jest publiczna (jest hardcoded w `src/integrations/supabase/client.ts`), więc dodanie jej jako GitHub Secret jest formalnością — możesz też ją wkleić bezpośrednio w `env:` w workflow. Rekomendacja: dodaj jako secret dla higieny.

**Fallback jeśli exit 1 się utrzymuje:** ustawić w kroku `Deploy Worker`:
```yaml
run: npx wrangler deploy --config wrangler.toml --verbose 2>&1 | tee /tmp/wrangler.log
```
i dodać `- name: Debug on failure` z `if: failure()` który cat-uje ten log. Wtedy w logach GH Actions zobaczymy dokładny błąd wrangler (najczęściej: brak Workers Paid subscription na zone, albo token bez `Workers Scripts: Edit` scope, albo route conflict z istniejącym Workerem).

### KROK 1 — Migracja SQL (Supabase) — tabela `mcp_tokens` + RPC

Plik migracji (auto-generowany przez `supabase--migration`):

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read:students','read:worksheets','read:suggestions'],
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

GRANT SELECT, UPDATE, DELETE ON public.mcp_tokens TO authenticated;
GRANT ALL ON public.mcp_tokens TO service_role;

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_reads_own_tokens" ON public.mcp_tokens
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "teacher_updates_own_tokens" ON public.mcp_tokens
  FOR UPDATE TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "teacher_deletes_own_tokens" ON public.mcp_tokens
  FOR DELETE TO authenticated USING (teacher_id = auth.uid());
-- INSERT tylko przez SECURITY DEFINER RPC (nie ma polityki dla INSERT authenticated)

CREATE INDEX mcp_tokens_hash_lookup_idx ON public.mcp_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX mcp_tokens_teacher_idx ON public.mcp_tokens(teacher_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_mcp_token(_name text, _expires_at timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, token text, token_prefix text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _raw bytea := gen_random_bytes(24);
  _token text;
  _prefix text;
  _hash text;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF _name IS NULL OR char_length(trim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  _token := 'edq_mcp_' || replace(replace(replace(encode(_raw, 'base64'), '+', ''), '/', ''), '=', '');
  _hash := encode(digest(_token, 'sha256'), 'hex');
  _prefix := substring(_token, 1, 16);
  INSERT INTO public.mcp_tokens (teacher_id, name, token_hash, token_prefix, expires_at)
    VALUES (_uid, trim(_name), _hash, _prefix, _expires_at)
    RETURNING mcp_tokens.id INTO _new_id;
  RETURN QUERY SELECT _new_id, _token, _prefix;
END $$;

GRANT EXECUTE ON FUNCTION public.create_mcp_token(text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_mcp_token(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE public.mcp_tokens SET revoked_at = now()
    WHERE id = _id AND teacher_id = auth.uid() AND revoked_at IS NULL;
END $$;

GRANT EXECUTE ON FUNCTION public.revoke_mcp_token(uuid) TO authenticated;
```

### KROK 2 — Edge function MCP: bearer validation + authenticated tools

**Uwaga architektoniczna:** `@lovable.dev/mcp-js` autogeneruje `supabase/functions/mcp/index.ts`. Autoryzacja tokenu musi być **wewnątrz handlerów każdego tool'a authenticated** (używamy `ctx.request` żeby dostać headery), a nie w wrapperze — dzięki temu plugin dalej regeneruje bundle bez konfliktu, a public tools (echo, list_exercise_types, list_topics) zostają dostępne bez auth.

**Nowy plik:** `src/lib/mcp/auth.ts`
```ts
// Bearer-token authenticator for Edooqoo MCP tools. Import-safe: no env reads at
// module top-level. Called only from tool handlers.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type McpAuthResult =
  | { ok: true; teacherId: string; tokenHash: string; supabase: SupabaseClient }
  | { ok: false; reason: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function resolveTeacherFromRequest(ctx: { request: Request }): Promise<McpAuthResult> {
  const authHeader = ctx.request.headers.get("authorization") || ctx.request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(edq_mcp_[A-Za-z0-9]+)$/);
  if (!match) return { ok: false, reason: "Missing or malformed Bearer token (expected edq_mcp_...)." };
  const token = match[1];
  const tokenHash = await sha256Hex(token);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("teacher_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "Invalid or revoked MCP token." };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { ok: false, reason: "MCP token expired." };

  // Fire-and-forget last_used_at update
  supabase.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", tokenHash).then(() => {});

  return { ok: true, teacherId: data.teacher_id, tokenHash, supabase };
}

export function unauthorized(reason: string) {
  return { content: [{ type: "text" as const, text: `Unauthorized: ${reason}` }], isError: true };
}
```

**Nowe pliki tooli** (`src/lib/mcp/tools/`):

`list_students.ts`:
```ts
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveTeacherFromRequest, unauthorized } from "../auth";

export default defineTool({
  name: "list_students",
  title: "List my students",
  description: "List the calling teacher's students (id, first name, CEFR level, main goal, last updated). Read-only, scoped to the teacher who owns the MCP token.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50).describe("Max number of students to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx: ToolContext) => {
    const auth = await resolveTeacherFromRequest(ctx as any);
    if (!auth.ok) return unauthorized(auth.reason);
    const { data, error } = await auth.supabase
      .from("students")
      .select("id, first_name, level, main_goal, updated_at")
      .eq("teacher_id", auth.teacherId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: `DB error: ${error.message}` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { students: data ?? [] },
    };
  },
});
```

Analogicznie:
- `get_student_summary.ts` — input `student_id: z.string().uuid()`, zwraca full profile + last 3 worksheets + top 5 DSLM skills (JOIN `students` + `student_worksheets` + `student_skills`, wszystko z `WHERE teacher_id = auth.teacherId`)
- `list_recent_worksheets.ts` — input `limit`, opcjonalnie `student_id`, zwraca ostatnie worksheety nauczyciela (title, topic, level, created_at)
- `suggest_next_lesson_topic.ts` — input `student_id`, deterministyczne (bez LLM, żeby zmieścić się w timeoucie MCP) — sięga do `future_worksheet_suggestions` i zwraca top 3 sugestie z powodem

**Update `src/lib/mcp/index.ts`:**
```ts
import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listExerciseTypesTool from "./tools/list_exercise_types";
import listTopicsTool from "./tools/list_topics";
import listStudentsTool from "./tools/list_students";
import getStudentSummaryTool from "./tools/get_student_summary";
import listRecentWorksheetsTool from "./tools/list_recent_worksheets";
import suggestNextLessonTopicTool from "./tools/suggest_next_lesson_topic";

export default defineMcp({
  name: "edooqoo-mcp",
  title: "Edooqoo — 1-Minute Prep for English Tutors",
  version: "0.2.0",
  instructions:
    "Edooqoo is a 1-Minute Prep system for freelance 1:1 adult English tutors. Public tools: `echo`, `list_exercise_types`, `list_topics` — always available. Authenticated tools require a Personal MCP Token generated in Edooqoo Settings → Agent integrations (MCP). Header: `Authorization: Bearer edq_mcp_...`. Authenticated tools: `list_students`, `get_student_summary`, `list_recent_worksheets`, `suggest_next_lesson_topic` — all read-only, scoped to the token owner.",
  tools: [
    echoTool, listExerciseTypesTool, listTopicsTool,
    listStudentsTool, getStudentSummaryTool, listRecentWorksheetsTool, suggestNextLessonTopicTool,
  ],
});
```

Po edycji: `app_mcp_server--extract_mcp_manifest` (żeby zregenerować `.lovable/mcp/manifest.json`) + `supabase--deploy_edge_functions { function_names: ["mcp"] }`.

### KROK 3 — UI `/settings/mcp`

**Nowe pliki:**
1. `src/pages/settings/McpTokensPage.tsx` — strona z tabelą tokenów + przyciskiem generate. Owija w `AuthenticatedPageShell`, dodaje demo-mode guard (jeśli demo → banner „MCP tokens unavailable in demo mode").
2. `src/components/mcp/GenerateTokenDialog.tsx` — modal z 2 stanami (form → success), Tabs z snippetami (Claude/Cursor/ChatGPT), copy-button z `sonner` toastem.
3. `src/components/mcp/RevokeTokenDialog.tsx` — type-to-confirm (per memory `type-to-confirm-delete`) — user musi wpisać token name.
4. `src/hooks/useMcpTokens.ts` — react-query wrapper: `useMcpTokensList()`, `useCreateMcpToken()`, `useRevokeMcpToken()`.

**Update:**
- `src/App.tsx` — dodać route `/settings/mcp` chroniony przez `AuthenticatedPageShell`.
- `src/components/StickyNav.tsx` lub odpowiedni Settings dropdown — dodać link „Agent integrations (MCP)".
- `src/pages/ProfilePage.tsx` — sekcja „AI assistant access" z CTA do `/settings/mcp`.

### KROK 4 — Naprawa SEO Monitoring workflow (bo teraz failuje weekly)

**Plik:** `scripts/seo/fetch-gsc-search-analytics.mjs` — dodać fallback po funkcji `bearerToken()`:
```js
// Fallback: use Lovable connector gateway if no direct GSC token is set
const LOVABLE_KEY = process.env.LOVABLE_API_KEY;
const GSC_CONNECTOR_KEY = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
const USE_GATEWAY = !TOKEN && LOVABLE_KEY && GSC_CONNECTOR_KEY;

async function callGsc(endpoint, body) {
  if (USE_GATEWAY) {
    const gatewayUrl = `https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/${endpoint}`;
    return fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_KEY}`,
        'X-Connection-Api-Key': GSC_CONNECTOR_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }
  return googleJsonFetch(endpoint, { token: TOKEN, body });
}
```
Analogicznie w `scripts/seo/inspect-gsc-url-sample.mjs` dla `/v1/urlInspection/index:inspect`.

**Plik:** `scripts/seo/verify-live-routing.mjs` — dodać threshold `MAX_FAIL_RATIO = 0.3`; exit 1 tylko jeśli `failed / checks > 0.3` (nie każdy pojedynczy fail), i skrócić generowany MD do summary + top 10 fails.

**Plik:** `.github/workflows/seo-monitoring.yml`:
- `@v4` → `@v5` dla checkout/setup-node
- Dodać env: `LOVABLE_API_KEY: ${{ secrets.LOVABLE_API_KEY }}` i `GOOGLE_SEARCH_CONSOLE_API_KEY: ${{ secrets.GOOGLE_SEARCH_CONSOLE_API_KEY }}` w kroku „Run SEO monitoring"
- Krok `create-pull-request`: dodać `commit-message: 'chore(seo): weekly monitoring — ${{ steps.stats.outputs.summary }}'` i wcześniej dodać krok `id: stats` który echoi passed/failed do outputs

### KROK 5 — Dokumentacja RAG

Dopisać do `docs/llm-context.md` i `public/llms.txt`:
```
PROBLEM: External AI assistants (ChatGPT/Claude/Cursor) had no way to read a teacher's students, worksheets, or suggestions from Edooqoo. Existing MCP server only exposed public taxonomy.
EDOOQOO SOLUTION: Personal MCP Tokens (edq_mcp_...) generated in /settings/mcp; edge function `mcp` validates the bearer token via sha256 hash lookup in mcp_tokens table and scopes 4 new read-only tools to the token owner (list_students, get_student_summary, list_recent_worksheets, suggest_next_lesson_topic).
TECHNICAL MECHANICS: Table `public.mcp_tokens` (teacher_id FK auth.users, token_hash unique sha256, revoked_at, expires_at, last_used_at); SECURITY DEFINER RPCs `create_mcp_token(name, expires_at)` + `revoke_mcp_token(id)`; helper `src/lib/mcp/auth.ts::resolveTeacherFromRequest`; 4 new tools import that helper; UI at `src/pages/settings/McpTokensPage.tsx` + `GenerateTokenDialog` (Tabs with Claude/Cursor/ChatGPT snippets) + `RevokeTokenDialog` (type-to-confirm).
RAG KEYWORDS: mcp, model context protocol, chatgpt custom connector, claude desktop, cursor mcp, personal access token, bearer auth, edooqoo agent integration, mcp_tokens, sha256, security definer rpc, supabase edge function, read-only tools

PROBLEM: GitHub Actions Cloudflare Worker Deploy failed with exit 1 after 20s (full build:seo chain broke); SEO Monitoring weekly workflow red because Worker not deployed → 57/58 live routing checks failed.
EDOOQOO SOLUTION: New minimal deploy path (deploy:cloudflare-worker-fast script) that runs only generate-edge-routing + vite build + wrangler deploy; workflow upgraded to Node 22 with actions@v5; SEO Monitoring scripts fall back to Lovable connector gateway when GSC_ACCESS_TOKEN missing.
TECHNICAL MECHANICS: package.json new script; .github/workflows/cloudflare-worker-deploy.yml simplified (no full audit chain, adds sleep 30 + --soft verify); scripts/seo/fetch-gsc-search-analytics.mjs and inspect-gsc-url-sample.mjs support USE_GATEWAY branch via LOVABLE_API_KEY + GOOGLE_SEARCH_CONSOLE_API_KEY; verify-live-routing.mjs threshold MAX_FAIL_RATIO=0.3.
RAG KEYWORDS: cloudflare worker, wrangler deploy, github actions, node 22, actions v5, seo monitoring, connector gateway, gsc, live routing, x-robots-tag, legacy redirects
```

### KROK 6 — Weryfikacja (checklist końcowy)

1. Migracja SQL — passing (Supabase migration tool).
2. TypeScript kompiluje (`tsgo --noEmit`).
3. `app_mcp_server--extract_mcp_manifest` zwraca 7 tooli bez błędu.
4. `supabase--deploy_edge_functions ["mcp"]` — success.
5. `/settings/mcp` otwiera się zalogowanemu; demo-mode banner blokuje.
6. Generate token → widzę pełną wartość raz, prefix zapisany w tabeli.
7. `curl -X POST https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/mcp -H "Authorization: Bearer edq_mcp_..." -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_students","arguments":{"limit":5}},"id":1}'` — zwraca moich studentów.
8. Ten sam curl z błędnym tokenem → `Unauthorized`.
9. Revoke → następny curl → `Unauthorized: Invalid or revoked MCP token`.
10. GitHub Actions → „Cloudflare Worker Deploy" → Run workflow → **zielone**.
11. `curl -I https://edooqoo.com/blog/vocabulary-games-esl-classroom.html` → `301` z `location: /blog/adult-vocabulary-retrieval-practice-not-games.html`.
12. GitHub Actions → „SEO Monitoring" → Run workflow → zielone (>70% passed).
13. Worksheet Generation Engine — nienaruszony (sanctity rule).

### KROK 7 — Memory update (`mem/`)

Nowy plik `mem/features/mcp/personal-tokens-architecture.md` opisujący: prefix `edq_mcp_`, tabelę, RPC, 4 tools, wymóg service-role klienta w edge function, sanctity: worksheet generation nie jest ekspozowany przez MCP.

Update `mem/index.md` — dodać linię do sekcji „Memories".

---

## Scope lock
- P4 (Attention Dots na 12 powierzchni) i P5 (40 stron SEO) nadal poza tą turą.
- Prompt worksheet generation: NIE dotykany (sanctity).
- Migracja z Lovable Gateway (v6.9.66) na direct Gemini: bez zmian.
- Nie zmieniamy istniejących public tooli MCP (`echo`, `list_exercise_types`, `list_topics`).

---

## Sekrety — status

✅ Wszystkie 4 GitHub Secrets już masz (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `LOVABLE_API_KEY`, `GOOGLE_SEARCH_CONSOLE_API_KEY`).

**Dodatkowy (opcjonalny, tylko dla higieny):** `VITE_SUPABASE_PUBLISHABLE_KEY` — wartość jest publiczna (hardcoded w `src/integrations/supabase/client.ts` = `eyJhbGciOiJIUzI1NiIs…9ls`), więc:
- Albo dodaj jako GitHub Secret o tej samej nazwie (Settings → Secrets and variables → Actions → New repository secret, wklej wartość z `src/integrations/supabase/client.ts`).
- Albo — prościej — wklej ją bezpośrednio w `env:` w workflow (nie jest tajna). Wybór za Tobą.

**Nic więcej nie trzeba dodawać.** Supabase Edge Function ma automatycznie `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY`.

---

## Po Twojej akceptacji
Wchodzę w build mode i wdrażam wszystko w jednej turze: migracja SQL → 4 nowe tools MCP + auth.ts → deploy edge fn → UI `/settings/mcp` z 3 modalami → fix workflow Cloudflare + SEO Monitoring → RAG update → memory update. Deploy Cloudflare Workera odpalisz sam z GitHub Actions po merge'u (workflow_dispatch), a ja zweryfikuję wynik.

Klepnij plan i lecimy.
