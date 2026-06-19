# Plan v6.9.64 — Problem Resolution Cycle: worksheet z obrazem, modal, mini-progress, header

## Affected surface

- `supabase/functions/generateWorksheet/index.ts`
  - JSON parse/recovery path: `parseWithRecovery`, `repairWorksheetJsonWithAI`
  - Streaming path: `generateWithGeminiStream`, SSE `progress/done/error`, DB insert
  - Non-streaming fallback path: same parser, same DB shape
- `supabase/functions/generateWorksheet/helpers.ts`
  - Deterministic JSON repair currently mutates quote/newline patterns too broadly
- `supabase/functions/generateWorksheet/prompts/core-instructions.ts`
  - Only if needed for safe media-context truncation; no worksheet-engine wording changes
- `supabase/functions/generateWorksheet/prompts/prompt-composer.ts`
  - Only if needed to pass a sanitized media object; no prompt logic rewrite
- `src/hooks/useWorksheetGeneration.tsx`
  - SSE completion handling, DB reconciliation, setting worksheet state, URL transition, suggestion marking
- `src/services/worksheetStreamService.ts`
  - Progress event parsing; currently only discrete exercise count is passed to UI
- `src/lib/worksheet/generationJobRegistry.ts`
  - Per-job progress currently stores only exercise count, expected total, phase
- `src/hooks/useActiveWorksheetGenerationJob.tsx`
  - Polling completion path for background jobs and side effects
- `src/components/GeneratingModal.tsx`
  - Main modal header layout, progress source, percent rendering
- `src/components/generation/GlobalGeneratingModal.tsx`
  - Passes job metadata and progress into `GeneratingModal`
- `src/components/generation/ActiveGenerationMiniPanel.tsx`
  - Mini-modal percent and progress bar currently jump because percent is derived from exercise count once stream starts
- `docs/llm-context.md`
  - RAG injection for v6.9.64 mechanics
- `public/llms.txt`
  - LLM index update for v6.9.64 mechanics

---

# Problem 1 — Worksheet with image: image generation works, worksheet generation becomes unstable

## Dependency scan

### Direct dependencies
- `generate-image` now succeeds and returns `image.url`, `image.detailedDescription`, R2 URL, and metadata.
- `mediaService.generateImageForWorksheet()` passes that image object into `useWorksheetGeneration`.
- `useWorksheetGeneration` injects `selectedImage` into `formDataForStorage` and sends it to `generateWorksheet`.
- `generateWorksheet` passes `selectedImage.detailedDescription` into `composeSystemMessage()`.
- `generateWithGeminiStream()` asks Gemini 2.5 Flash for full JSON with `responseMimeType: application/json`.
- `parseAIResponse()` first parses directly, then applies deterministic repair, then `repairWorksheetJsonWithAI()`.
- If parsing finally succeeds, DB row is inserted and the client gets SSE `done`.
- If parsing fails or repair is slow, the stream can stay in `repairing` or terminate without the UI receiving a clean `done`.

### Observed signal from logs
- `generate-image` is healthy: image generated, vision description generated, R2 upload successful.
- `generateWorksheet` reaches full exercise count (`8/8`) and enters `phase: repairing`.
- Local JSON parse fails with `Expected ':' after property name`.
- The broken output length is around `39k-42k`, not near DB truncation limits.
- A later DB row exists for the same topic with `has_image=true`, `ai_response` valid JSON, `html_content` valid JSON, and `8` exercises. This proves the backend can eventually save, but the recovery path is too slow/flaky for the live UI and Next Step handoff.

## Root cause

The structural cause is that image-based worksheet prompts add a large unbounded visual description into an already large JSON-only generation, and the current recovery layer treats malformed model JSON as a post-hoc repair problem instead of reducing the payload size and using a safer JSON-mode fallback before AI repair.

## Solution options

| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Parser-only hardening | Improve deterministic repair and keep the same generation payload/model flow | Fastest patch, but still asks Gemini to produce very large image worksheet JSON in one pass | Medium: may still fail on large picture worksheets |
| B. Payload + fallback hardening | Cap/sanitize only the image description passed to the worksheet prompt, keep original image object in DB, add model fallback when streaming JSON parse fails, and keep AI repair as last resort | Best balance: reduces malformed JSON probability and improves recovery without changing worksheet pedagogy | Low/Medium: touches Edge Function flow but not protected prompt wording |
| C. Split image worksheets into multiple generation calls | Generate picture exercises separately from non-picture exercises and merge | Strongest reliability, but changes worksheet generation architecture and risks the protected engine | High: violates sanctity unless explicitly requested |

## Selected solution + why

I wybieram Option B. Nie zmieniamy treści ani logiki Worksheet Generation Engine; ograniczamy tylko techniczne ryzyko nadmiarowego `selectedImage.detailedDescription` oraz dodajemy bezpieczny fallback modelu/parsing path. To naprawia realny warunek awarii: obraz działa, ale opis obrazu powiększa i destabilizuje JSON dla worksheetu.

## Impact analysis

### What changes beyond immediate problem
- Picture worksheets should produce less malformed JSON and exit `repairing` faster.
- Non-picture worksheets remain on the same primary streaming path.
- Audio worksheets remain unaffected except for shared parser safety.
- DSLM Next Step marking becomes more reliable because completion will be detected by clean `done` or DB reconciliation.

### Zero regressions confirmed
- No change to image model selection in `generate-image`.
- No change to worksheet educational prompt wording or exercise templates.
- No change to token consumption policy.
- No change to DB schema.
- No change to RLS.
- No change to worksheet display/export components.

## Full implementation (zero placeholders)

### 1. Add a worksheet-local media-context sanitizer in `generateWorksheet/index.ts`

Add helper before `serve()`:

```ts
function truncateAtSentenceBoundary(value: string, maxChars: number): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('; '),
    slice.lastIndexOf(': '),
  );
  if (lastBoundary > Math.floor(maxChars * 0.55)) {
    return slice.slice(0, lastBoundary + 1).trim();
  }
  return `${slice.trim()}...`;
}

function buildWorksheetMediaContextImage(selectedImage: any): any {
  if (!selectedImage) return null;
  const rawDescription = selectedImage?.detailedDescription || selectedImage?.description || '';
  return {
    ...selectedImage,
    detailedDescription: truncateAtSentenceBoundary(rawDescription, 1200),
  };
}
```

Use only this sanitized object for prompt composition:

```ts
const selectedImage = formData?.selectedImage || null;
const selectedAudio = formData?.selectedAudio || null;
const worksheetPromptImage = buildWorksheetMediaContextImage(selectedImage);
```

Then call:

```ts
const systemMessage = composeSystemMessage(
  hasGrammarFocus,
  grammarFocus,
  formData,
  exerciseCount,
  effectiveExercises,
  worksheetPromptImage,
  selectedAudio,
  exerciseFocusMap,
);
```

Important: DB insert continues saving sanitized DB image from original `selectedImage`, not `worksheetPromptImage`, so R2 URL and metadata are preserved.

### 2. Add parse-safe fallback generation, not only repair

Add helper:

```ts
async function generateFallbackJsonWithOpenAI(systemMessage: string, userMessage: string): Promise<{ content: string; model: string }> {
  console.log('🟠 [JSON-FALLBACK] Regenerating worksheet JSON with GPT-5-mini after malformed Gemini JSON');
  const response = await (openai.chat.completions.create as any)({
    model: 'gpt-5-mini-2025-08-07',
    temperature: 1,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
    max_completion_tokens: 30000,
    response_format: { type: 'json_object' },
  });
  return {
    content: response.choices?.[0]?.message?.content || '',
    model: 'gpt-5-mini-2025-08-07-json-fallback',
  };
}
```

Add wrapper:

```ts
async function parseOrRegenerateWithFallback(params: {
  rawContent: string;
  expectedExerciseCount: number;
  systemMessage: string;
  sanitizedPrompt: string;
  allowRegenerateFallback: boolean;
}): Promise<{ data: any; content: string; repairMethod: string; modelOverride?: string }> {
  try {
    const parsed = await parseWithRecovery(params.rawContent, params.expectedExerciseCount);
    return { data: parsed.data, content: params.rawContent, repairMethod: parsed.repairMethod };
  } catch (firstError) {
    if (!params.allowRegenerateFallback) throw firstError;
    console.warn('⚠️ [JSON-FALLBACK] Parse/repair failed; trying full JSON regeneration fallback');
    const fallback = await generateFallbackJsonWithOpenAI(params.systemMessage, params.sanitizedPrompt);
    const parsed = await parseWithRecovery(fallback.content, params.expectedExerciseCount);
    return {
      data: parsed.data,
      content: fallback.content,
      repairMethod: parsed.repairMethod === 'none' ? 'model-fallback' : `model-fallback+${parsed.repairMethod}`,
      modelOverride: fallback.model,
    };
  }
}
```

In streaming path replace:

```ts
const result = await parseWithRecovery(fullContent, expectedTotal);
worksheetData = result.data;
repairMethod = result.repairMethod;
```

with:

```ts
const result = await parseOrRegenerateWithFallback({
  rawContent: fullContent,
  expectedExerciseCount: expectedTotal,
  systemMessage,
  sanitizedPrompt,
  allowRegenerateFallback: hasPictureMedia,
});
worksheetData = result.data;
fullContent = result.content;
repairMethod = result.repairMethod;
if (result.modelOverride) streamUsedModel = result.modelOverride;
```

In regular path apply the same wrapper with `allowRegenerateFallback: hasPictureMedia`.

This keeps non-image generations unchanged unless normal repair already fails.

### 3. Make deterministic repair less destructive in `helpers.ts`

Replace the broad rule:

```ts
repaired = repaired.replace(/"(\s*)\n\s*"/g, ...)
```

with narrower, property-like patterns only:

```ts
repaired = repaired.replace(
  /"([A-Za-z_][A-Za-z0-9_]{0,60})"\s*\n\s*("|\{|\[|true|false|null|-?\d)/g,
  '"$1":\n$2'
);
```

Keep other deterministic repairs.

Why: current rule can corrupt valid arrays of strings by turning adjacent quoted strings into a key/value pair. This can make a recoverable model issue worse.

### 4. Emit more granular progress during repair/fallback

When entering parse/repair:

```ts
safeSend('progress', { exercisesGenerated: expectedTotal, expectedTotal, phase: 'repairing', percent: 92 });
```

Inside repair keepalive:

```ts
let repairTick = 0;
const repairKeepalive = setInterval(() => {
  repairTick += 1;
  safeSend('progress', {
    exercisesGenerated: expectedTotal,
    expectedTotal,
    phase: 'repairing',
    percent: Math.min(98, 92 + repairTick),
  });
}, 5000);
```

Before DB insert:

```ts
safeSend('progress', { exercisesGenerated: expectedTotal, expectedTotal, phase: 'saving', percent: 99 });
```

On final `done`, client sets 100.

## Verification checklist

- Generate worksheet with image exercise set for `Extracting Information from Academic Charts or Graphs`.
- Confirm `generate-image` still uses Vertex and R2 successfully.
- Confirm `generateWorksheet` logs either `JSON parsed successfully` or `model-fallback` and sends `done`.
- Confirm created DB row has valid `html_content`, valid `ai_response`, `8` exercises, and `selected_image` with URL.
- Confirm Next Step suggestion is marked `is_used=true` only after worksheet row exists.
- Confirm non-image worksheet still generates without fallback.
- Confirm no worksheet prompt text/template wording was changed.

---

# Problem 2 — Worksheet generated but UI closes modal and shows filled form instead of opening worksheet

## Dependency scan

### Direct dependencies
- `useWorksheetGeneration.handleWorksheetCompletion()` sets worksheet state, then `window.history.pushState({}, '', /worksheet/:id)`.
- `Index.tsx` conditionally renders `GenerationView` only when local in-memory `bothWorksheetsReady` is true.
- `App.tsx` route rendering is controlled by React Router, not raw browser history state.
- `window.history.pushState` does not notify React Router, so URL may change without route state actually loading `WorksheetPage`.
- In background/polling completion path, mini-panel can know worksheet is complete, but Index local state may not be hydrated.

## Root cause

The structural cause is that generation completion uses raw `window.history.pushState` instead of React Router navigation or a route-change event, so the app can save a worksheet but leave the current route/component tree in the form state.

## Solution options

| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Replace `pushState` with `window.location.assign` | Hard reload to `/worksheet/:id` | Very reliable but reloads the SPA and feels heavy | Low functional, medium UX |
| B. Dispatch a navigation event and let Index call `navigate()` | Keeps hook decoupled from router imports, uses React Router correctly | Requires small listener in `Index.tsx` | Low |
| C. Move generation hook inside route-aware component and pass `navigate` into hook | Clean architecture, but larger refactor | More code movement | Medium |

## Selected solution + why

I wybieram Option B. Minimalnie dotyka istniejący kod, nie wymusza reloadu i rozwiązuje właściwy błąd: React Router musi dostać sygnał nawigacji, nie tylko zmieniony URL w historii przeglądarki.

## Impact analysis

### What changes beyond immediate problem
- Manual generation completion opens `/worksheet/:id` reliably.
- Auto-generate from DSLM opens saved worksheet after completion.
- Polling/background completion can also route when current tab is responsible for that generation.

### Zero regressions confirmed
- Existing `GenerationView` in-memory display can still work during immediate success.
- `/worksheet/:id` route already exists and loads from DB.
- Anonymous worksheet access within 24h remains unchanged.
- Token consumption and suggestion marking remain after DB row creation.

## Full implementation (zero placeholders)

### 1. Add a typed browser event from completion path

In `useWorksheetGeneration.handleWorksheetCompletion()`, replace raw `pushState` block:

```ts
window.history.pushState({}, '', `/worksheet/${finalWorksheetId}`);
```

with:

```ts
try {
  window.dispatchEvent(new CustomEvent('worksheet:navigateToGenerated', {
    detail: { worksheetId: finalWorksheetId },
  }));
} catch {
  window.location.assign(`/worksheet/${finalWorksheetId}`);
}
```

Keep state-setting before this event so if Index chooses to render in-memory it has data.

### 2. Add listener in `Index.tsx`

Inside `Index`, after `navigate` is available:

```ts
useEffect(() => {
  const onNavigateToGenerated = (event: Event) => {
    const worksheetId = (event as CustomEvent<{ worksheetId?: string }>).detail?.worksheetId;
    if (!worksheetId) return;
    navigate(`/worksheet/${worksheetId}`, { replace: false });
  };
  window.addEventListener('worksheet:navigateToGenerated', onNavigateToGenerated);
  return () => window.removeEventListener('worksheet:navigateToGenerated', onNavigateToGenerated);
}, [navigate]);
```

### 3. Preserve current state updates

Do not remove:
- `worksheetState.setWorksheetId(finalWorksheetId)`
- `worksheetState.setGeneratedWorksheet(deepFixedWorksheet)`
- `worksheetState.setEditableWorksheet(deepFixedWorksheet)`
- `worksheetGenerationSuccess` event
- `completeGenerationJob(jobId, finalWorksheetId)`

These remain necessary for immediate UI state, form persistence clearing, and mini-panel.

## Verification checklist

- Generate a normal worksheet: modal closes and app opens `/worksheet/:id`.
- Generate an image worksheet: app opens `/worksheet/:id` after final success.
- Start from DSLM Next Step: suggestion marks used and generated worksheet opens.
- Refresh `/worksheet/:id`: worksheet loads from DB.
- No case leaves user on the filled form after a successful DB insert.

---

# Problem 3 — Mini-modal percent jumps instead of updating live

## Dependency scan

### Direct dependencies
- Main `GeneratingModal` has local time-based `progress` increasing each second.
- `ActiveGenerationMiniPanel` uses `pct = exercisesGenerated / expectedTotal * 100` once stream progress exists.
- Therefore before stream metadata it moves by elapsed fallback, then after first exercise it snaps to `12%`, `25%`, `37%`, etc.
- Registry progress has no `percent`, `phaseStartedAt`, or `smoothPercent` field.

## Root cause

The structural cause is that mini-panels derive progress from coarse exercise counts, while the main modal uses local time-based interpolation; the two UI surfaces do not share the same progress model.

## Solution options

| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Mini-panel purely time-based | Ignore exercise count for percent; keep count as text only | Smooth but less truthful near completion | Low |
| B. Hybrid monotonic progress | Use server percent if present; otherwise interpolate between phase floors and exercise count, never decreasing | Smooth and still tied to real progress | Low |
| C. Backend sends percent every second | More accurate but requires more SSE traffic and Edge Function timers during generation | Medium |

## Selected solution + why

I wybieram Option B. Mini-panel ma wyglądać jak główny modal, ale nadal powinien pokazywać realne `0/8…8/8`. Percent będzie płynny i monotoniczny, a licznik ćwiczeń zostaje jako kontrolny wskaźnik faktycznego stanu.

## Impact analysis

### What changes beyond immediate problem
- Mini-panels move every second for all running jobs.
- During media phase, percent moves smoothly up to a media cap.
- During exercise phase, percent interpolates between exercise-count milestones.
- During repair/saving, percent moves from about 92 to 99 until done.

### Zero regressions confirmed
- No backend dependency required for baseline smoothing.
- Existing `exercisesGenerated/expectedTotal` labels remain.
- Completed and failed cards unchanged.
- Multiple concurrent mini-panels remain stacked.

## Full implementation (zero placeholders)

### 1. Extend progress type in `generationJobRegistry.ts`

Add optional percent fields:

```ts
progress?: {
  exercisesGenerated: number;
  expectedTotal: number;
  phase?: string;
  percent?: number;
} | null;
```

### 2. Pass percent through stream service

In `worksheetStreamService.ts`, update progress callback type:

```ts
onProgress?: (progress: {
  exercisesGenerated: number;
  expectedTotal: number;
  phase?: string;
  percent?: number;
}) => void;
```

Preserve unknown fields from SSE:

```ts
lastProgress = {
  exercisesGenerated: data?.exercisesGenerated ?? lastProgress.exercisesGenerated,
  expectedTotal: data?.expectedTotal ?? lastProgress.expectedTotal,
  phase: data?.phase,
  percent: typeof data?.percent === 'number' ? data.percent : undefined,
};
callbacks.onProgress?.(lastProgress);
```

### 3. Store percent in `useWorksheetGeneration.tsx`

Patch job progress:

```ts
progress: {
  exercisesGenerated: progress.exercisesGenerated,
  expectedTotal: progress.expectedTotal,
  phase: (progress as any)?.phase,
  percent: typeof (progress as any)?.percent === 'number' ? (progress as any).percent : undefined,
}
```

### 4. Replace mini-panel percent formula

In `ActiveGenerationMiniPanel.tsx`, compute smooth percent:

```ts
const estimatedDuration = (() => {
  let seconds = 50;
  if (job.formMeta?.requiresImage) seconds += 25;
  if (job.formMeta?.requiresAudio) seconds += 25;
  if (job.formMeta?.hasGrammar) seconds += 8;
  seconds += Math.max(0, (job.formMeta?.selectedExercises?.length || 6) - 6) * 4;
  return seconds;
})();

const pct = (() => {
  if (typeof progress?.percent === 'number') {
    return Math.max(0, Math.min(99, Math.round(progress.percent)));
  }

  if (progress?.phase === 'media') {
    return Math.min(18, Math.max(3, Math.round((elapsedSec / Math.max(20, estimatedDuration * 0.25)) * 18)));
  }

  if (progress && progress.expectedTotal > 0) {
    const completed = Math.max(0, progress.exercisesGenerated);
    const perExercise = 74 / progress.expectedTotal;
    const floor = 18 + completed * perExercise;
    const liveDrift = Math.min(perExercise * 0.85, Math.max(0, elapsedSec - 20) * 0.35);
    return Math.min(91, Math.round(floor + liveDrift));
  }

  return Math.min(18, Math.max(2, Math.round(elapsedSec * 0.8)));
})();
```

When `isCompleted`, progress is not shown; no need to reach 100 in mini running card.

## Verification checklist

- Start image worksheet and watch mini-panel: percent changes every second.
- Confirm mini-panel count still updates discretely (`0/8`, `1/8`, etc.).
- Confirm percent never goes backwards when first SSE progress arrives.
- Confirm multiple mini-panels each keep independent timers.
- Confirm completed card still shows CTA, not progress bar.

---

# Problem 4 — Large modal header should use two clean lines, not three

## Dependency scan

### Direct dependencies
- `GeneratingModal.tsx` header currently renders:
  - line 1: `Generating Your Worksheet`
  - line 2: `For Evelyn H · email`
  - line 3: topic preview
- On the screenshot, desired layout is:
  - line 1: `Generating Your Worksheet` + `For Evelyn H`
  - line 2: `email` + `“Following a Simple Argument in a Short Academic Passage”`
- Modal width on desktop: `lg:max-w-[1080px]`, left column grid around half width.
- Must not break mobile; mobile can stack more conservatively.

## Root cause

The structural cause is that the header treats title, student, email, and topic as separate block rows instead of a responsive two-row metadata layout.

## Solution options

| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Inline everything in one row | Single header row with title, student, email, topic | Too cramped and bad on smaller desktop | Medium |
| B. Two-row responsive header | Desktop: title+student row, email+topic row. Mobile: stacked readable rows | Matches requested layout and preserves responsiveness | Low |
| C. Shrink fonts globally | Might fit but weakens hierarchy and does not fix structure | Low but poor UX |

## Selected solution + why

I wybieram Option B. Dokładnie realizuje wskazany układ i nie wymusza nienaturalnego ściskania tekstu. Na mobile zachowujemy czytelność, na desktop ograniczamy do dwóch linii z kontrolowanym `truncate`.

## Impact analysis

### What changes beyond immediate problem
- Single-job modal header becomes more compact.
- Long email/topic are truncated gracefully rather than wrapping into messy rows.
- Multi-job switcher remains below header and unchanged except spacing if needed.

### Zero regressions confirmed
- Student profile link remains.
- Student email fallback remains.
- Topic preview remains.
- Multi-job cards remain selectable.
- No changes to modal carousel/context panel.

## Full implementation (zero placeholders)

In `GeneratingModal.tsx`, replace the header block around lines rendering `h2`, student row, and topic preview with:

```tsx
<div className="space-y-1 min-w-0">
  <div className="flex flex-col items-center justify-center gap-1 lg:flex-row lg:gap-2 min-w-0">
    <h2 className="shrink-0 text-xl lg:text-2xl font-semibold bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 bg-clip-text text-transparent">
      Generating Your Worksheet
    </h2>
    {studentName ? (
      <div className="min-w-0 text-xs lg:text-sm text-muted-foreground">
        <span className="text-muted-foreground/70">For </span>
        {studentId ? (
          <a
            href={`/student/${studentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {studentName}
          </a>
        ) : (
          <span className="font-medium text-foreground">{studentName}</span>
        )}
      </div>
    ) : null}
  </div>

  {(studentName || (jobsCount <= 1 && jobs?.[0]?.topic)) ? (
    <div className="mx-auto flex max-w-full items-center justify-center gap-1.5 text-[11px] lg:text-xs text-muted-foreground/80 min-w-0">
      {studentName ? (
        <span className="min-w-0 max-w-[42%] truncate text-foreground/80">
          {studentEmail && studentEmail.trim().length > 0 ? studentEmail : 'no student email set'}
        </span>
      ) : null}
      {studentName && jobsCount <= 1 && jobs?.[0]?.topic ? (
        <span className="shrink-0 text-muted-foreground/50">·</span>
      ) : null}
      {jobsCount <= 1 && jobs?.[0]?.topic ? (
        <span className="min-w-0 truncate">
          “{jobs[0].topic}”
        </span>
      ) : null}
    </div>
  ) : null}
</div>
```

Remove the old separate student `<p>` and old topic `<p>` to avoid duplicate lines.

## Verification checklist

- Desktop modal line 1: `Generating Your Worksheet` + `For Evelyn H`.
- Desktop modal line 2: email + topic.
- Long topic truncates cleanly with ellipsis, no third row.
- Mobile remains readable and does not overflow.
- Student link still opens `/student/:id` in new tab.

---

# Combined RAG injection update

## `docs/llm-context.md`

Add a dense factual section under Worksheet Generation Runtime and Media Pipeline or append an update block near that section:

```md
### v6.9.64 Worksheet Image JSON Stability and Generation Navigation

PROBLEM: Image generation through `generate-image` can succeed while `generateWorksheet` stalls in JSON repair or saves in the background without the active UI opening the generated worksheet. Picture worksheets add large visual descriptions to a JSON-only worksheet generation request, increasing malformed JSON probability. The mini-panel progress previously used coarse exercise counts, causing jumpy percentages, and the large generating modal header split student/topic metadata into three rows.

EDOOQOO SOLUTION: `generateWorksheet` keeps Vertex/R2 image generation unchanged, but uses a worksheet-local truncated image description for prompt context, preserves the full stored image metadata, and adds a parse-safe model fallback for image worksheet JSON when local and AI repair fail. `useWorksheetGeneration` dispatches a React-router-aware generated worksheet navigation event instead of relying on raw `window.history.pushState`. The mini-panel uses a hybrid smooth progress model while retaining real exercise counts. `GeneratingModal` renders desktop metadata as two controlled rows: title plus student, then email plus topic.

TECHNICAL MECHANICS: Affected files: `supabase/functions/generateWorksheet/index.ts`, `supabase/functions/generateWorksheet/helpers.ts`, `src/hooks/useWorksheetGeneration.tsx`, `src/services/worksheetStreamService.ts`, `src/lib/worksheet/generationJobRegistry.ts`, `src/components/generation/ActiveGenerationMiniPanel.tsx`, `src/components/GeneratingModal.tsx`, `src/pages/Index.tsx`. The protected worksheet prompt templates are not rewritten. `generate-image` remains Vertex AI based and stores R2 image URLs. Completion remains DB-first: token consumption and `future_worksheet_suggestions.is_used` happen only after a worksheet row exists.

RAG KEYWORDS: image worksheet JSON repair, generateWorksheet repairing phase, Vertex image worksheet, R2 worksheet image, selectedImage detailedDescription truncation, malformed JSON recovery, model fallback JSON object, worksheetGenerationSuccess, generated worksheet navigation, React Router worksheet route, mini-panel smooth progress, generation modal header, Next Step is_used, clientGenerationId reconciliation, worksheet prompt sanctity
```

## `public/llms.txt`

Add a concise production map entry:

```md
[WORKSHEET_IMAGE_JSON_STABILITY_V6964] | Image-based worksheet generation preserves Vertex/R2 image generation but constrains worksheet-local image context, adds JSON fallback recovery, routes completed worksheets through React Router, and smooths mini-panel progress. | intents: image worksheet generation error, generateWorksheet JSON repair, worksheet generated but form remains, mini modal progress jump, generation modal layout | status: PRODUCTION | ref: llm-context.md#v6964-worksheet-image-json-stability-and-generation-navigation | canonical: https://edooqoo.com/ai-worksheet-generator-for-english-teachers.html
```

---

# Final change report planned

## Summary of what will be implemented
- Stabilize image worksheet generation after successful image creation by reducing prompt payload risk and adding model fallback recovery.
- Make successful worksheet completion reliably open `/worksheet/:id` through React Router.
- Make mini-modal progress percent update smoothly, independently per generation job.
- Rebuild the large modal header into the requested two-line layout.
- Update RAG docs so future agents do not reintroduce the same failure modes.

## Files planned to modify
- `supabase/functions/generateWorksheet/index.ts`
- `supabase/functions/generateWorksheet/helpers.ts`
- `src/hooks/useWorksheetGeneration.tsx`
- `src/services/worksheetStreamService.ts`
- `src/lib/worksheet/generationJobRegistry.ts`
- `src/components/generation/ActiveGenerationMiniPanel.tsx`
- `src/components/GeneratingModal.tsx`
- `src/pages/Index.tsx`
- `docs/llm-context.md`
- `public/llms.txt`

## Documentation updated
- YES, planned: `docs/llm-context.md` and `public/llms.txt`.

## Out of scope issues noted
- Full split-generation architecture for picture worksheets is intentionally not included because it would alter the protected Worksheet Generation Engine.
- Image model migration beyond current Vertex `gemini-2.5-flash-image` fallback chain is not included because `generate-image` is already healthy.
- Visual redesign of the full modal/context carousel is not included.
- Token/subscription logic is not changed.

## Verification result target
- PASS after implementation only if:
  - image worksheet creates DB row and opens `/worksheet/:id`,
  - non-image worksheet still works,
  - DSLM Next Step is marked used after success,
  - mini-panel percent moves every second,
  - large modal header matches the two-line layout,
  - RAG files are updated.