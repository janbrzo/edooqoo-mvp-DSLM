/**
 * Test world for the generateWorksheet Edge Function.
 *
 * Vitest cannot resolve the Deno URL imports (deno.land, esm.sh), so each test
 * file mocks those URLs with the factories exported here (see `modules`) and
 * then imports the real `index.ts` / `format-worksheet-prompt/index.ts`. Every
 * external effect (model calls, database calls, fetch, console) is recorded in
 * one ordered log so a test can snapshot the full externally observable
 * behaviour of the handler. No network is ever used.
 *
 * The same scenarios must keep producing identical records before and after a
 * refactor of the engine; that is what the snapshots prove.
 */
import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { vi } from 'vitest';

export const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
export const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
export const WORKSHEET_ID = '33333333-3333-4333-8333-333333333333';

export const ENV: Record<string, string> = {
  OPENAI_API_KEY: 'openai-key',
  GEMINI_API_KEY: 'gemini-key',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
};

export const FIXED_NOW = new Date('2026-10-28T10:00:00.000Z');

export type CallRecord = Record<string, unknown>;

export interface GeminiStreamScript {
  chunks: string[];
  /** Thrown from the stream after all chunks were delivered. */
  throwAfter?: Error;
  /** The stream yields nothing until this promise settles. */
  gate?: Promise<void>;
}

export interface World {
  /** Handler captured from the mocked `serve` / `Deno.serve`. */
  handler: ((req: Request) => Promise<Response>) | null;
  /** Ordered record of every external effect. */
  calls: CallRecord[];
  logs: string[];
  /** generateContent (non-streaming Gemini). */
  geminiGenerate: (prompt: string) => Promise<string>;
  /** generateContentStream. */
  geminiStream: (prompt: string, call: number) => GeminiStreamScript | Error;
  geminiStreamCalls: number;
  /** openai.chat.completions.create: return the (non-stream) response, or a chunk list when `params.stream`. */
  openai: (params: any, call: number) => unknown | Error;
  openaiCalls: number;
  student: { data: unknown };
  profile: { data: unknown; error?: unknown };
  insertResult: { data: unknown; error: unknown } | Error;
  /** Result of the geolocation cache lookup and the ipapi.co lookup. */
  geoCache: { data: unknown; error: unknown };
  ipapi: { ok: boolean; body: unknown } | Error;
  user: { id: string; is_anonymous: boolean } | null;
  /** Unredacted copies for the golden prompt snapshots. */
  raw: { gemini: string[]; openai: any[]; insertRows: any[] };
}

declare global {
  // eslint-disable-next-line no-var
  var __gwWorld: World;
}

export function newWorld(): World {
  return {
    handler: null,
    calls: [],
    logs: [],
    geminiGenerate: async () => {
      throw new Error('geminiGenerate not scripted');
    },
    geminiStream: () => new Error('geminiStream not scripted'),
    geminiStreamCalls: 0,
    openai: () => new Error('openai not scripted'),
    openaiCalls: 0,
    student: { data: { id: STUDENT_ID } },
    profile: { data: { email: 'teacher@example.test' } },
    insertResult: {
      data: [
        {
          id: WORKSHEET_ID,
          created_at: '2026-10-28T10:00:00.000Z',
          title: 'Saved title',
          share_token: 'share-token-from-db',
        },
      ],
      error: null,
    },
    geoCache: { data: null, error: { message: 'no rows' } },
    ipapi: { ok: true, body: { country_name: 'Poland', city: 'Warsaw' } },
    user: { id: TEACHER_ID, is_anonymous: false },
    raw: { gemini: [], openai: [], insertRows: [] },
  };
}

export const world = (): World => globalThis.__gwWorld;

// ---------------------------------------------------------------------------
// Redaction: keep snapshots readable. The full prompt text is covered by the
// golden prompt snapshots; end-to-end records keep a hash, the length and the
// user part (which is short).
// ---------------------------------------------------------------------------
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

export function summariseText(text: string) {
  return { sha256: sha(text), length: text.length };
}

const GEMINI_SEP = '\n\n---\n\nUser Request:\n';
const DB_SYSTEM = 'SYSTEM MESSAGE:\n';
const DB_USER = '\n\nUSER MESSAGE:\n';

export function summariseGeminiPrompt(prompt: string) {
  const i = prompt.lastIndexOf(GEMINI_SEP);
  if (i < 0) return { whole: summariseText(prompt) };
  return {
    system: summariseText(prompt.slice(0, i)),
    user: prompt.slice(i + GEMINI_SEP.length),
  };
}

export function summariseDbPrompt(prompt: string) {
  if (!prompt.startsWith(DB_SYSTEM)) return { whole: summariseText(prompt) };
  const i = prompt.lastIndexOf(DB_USER);
  return {
    system: summariseText(prompt.slice(DB_SYSTEM.length, i)),
    user: prompt.slice(i + DB_USER.length),
  };
}

function summariseOpenAiParams(params: any) {
  const out: Record<string, unknown> = { ...params };
  if (Array.isArray(params?.messages)) {
    out.messages = params.messages.map((m: any) =>
      m.role === 'system' && typeof m.content === 'string' && m.content.length > 4000
        ? { role: m.role, content: summariseText(m.content) }
        : m,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mock module factories (used from vi.mock factories in the test files)
// ---------------------------------------------------------------------------
function makeQuery(table: string) {
  const w = world();
  const rec: CallRecord = { kind: 'db', table };
  const filters: Array<[string, unknown]> = [];
  let pushed = false;
  const push = () => {
    if (!pushed) {
      pushed = true;
      w.calls.push(rec);
    }
  };
  const resolve = (): { data: unknown; error: unknown } => {
    if (table === 'students') return { data: (w.student as any).data, error: null };
    if (table === 'profiles') {
      const p = w.profile as any;
      if (p instanceof Error) throw p;
      return { data: p.data, error: p.error ?? null };
    }
    if (table === 'worksheets') {
      if (w.insertResult instanceof Error) throw w.insertResult;
      return w.insertResult;
    }
    if (table === 'geolocation_cache' && rec.op === 'select') return w.geoCache;
    return { data: null, error: null };
  };
  const builder: any = {
    select(columns?: string) {
      if (!rec.op) rec.op = 'select';
      rec.columns = columns ?? null;
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push([column, value]);
      rec.filters = [...filters];
      return builder;
    },
    insert(row: any) {
      rec.op = 'insert';
      world().raw.insertRows.push(row);
      rec.row = redactRow(table, row);
      return builder;
    },
    upsert(row: any, options: unknown) {
      rec.op = 'upsert';
      rec.row = row;
      rec.options = options;
      return builder;
    },
    single() {
      push();
      return Promise.resolve(resolve());
    },
    maybeSingle() {
      push();
      return Promise.resolve(resolve());
    },
    then(onFulfilled: any, onRejected: any) {
      push();
      return Promise.resolve()
        .then(resolve)
        .then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function redactRow(table: string, row: any) {
  if (table !== 'worksheets' || !row) return row;
  return { ...row, prompt: summariseDbPrompt(String(row.prompt)) };
}

const supabaseClient = () => ({
  from: (table: string) => makeQuery(table),
  auth: {
    getUser: async (token: string) => {
      const w = world();
      w.calls.push({ kind: 'auth.getUser', token });
      return w.user ? { data: { user: w.user }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } };
    },
  },
});

export const modules = {
  denoServe: () => ({
    serve: (handler: any) => {
      world().handler = handler;
    },
  }),
  supabase: () => ({ createClient: () => supabaseClient() }),
  openai: () => ({
    default: class {
      chat = {
        completions: {
          create: async (params: any) => {
            const w = world();
            const call = ++w.openaiCalls;
            w.raw.openai.push(params);
            w.calls.push({ kind: 'openai.chat.completions.create', params: summariseOpenAiParams(params) });
            const result = w.openai(params, call);
            if (result instanceof Error) throw result;
            if (params.stream) {
              const chunks = result as string[];
              return (async function* () {
                for (const c of chunks) yield { choices: [{ delta: { content: c } }] };
              })();
            }
            return result;
          },
        },
      };
    },
  }),
  gemini: () => ({
    GoogleGenerativeAI: class {
      constructor(public apiKey: string) {}
      getGenerativeModel(config: unknown) {
        return {
          generateContent: async (prompt: string) => {
            const w = world();
            w.raw.gemini.push(prompt);
            w.calls.push({ kind: 'gemini.generateContent', config, prompt: summariseGeminiPrompt(prompt) });
            const text = await w.geminiGenerate(prompt);
            return { response: { text: () => text } };
          },
          generateContentStream: async (prompt: string) => {
            const w = world();
            const call = ++w.geminiStreamCalls;
            w.raw.gemini.push(prompt);
            w.calls.push({ kind: 'gemini.generateContentStream', config, prompt: summariseGeminiPrompt(prompt) });
            const script = w.geminiStream(prompt, call);
            if (script instanceof Error) throw script;
            return {
              response: Promise.resolve({}),
              stream: (async function* () {
                if (script.gate) await script.gate;
                for (const c of script.chunks) yield { text: () => c };
                if (script.throwAfter) throw script.throwAfter;
              })(),
            };
          },
        };
      }
    },
  }),
};

// ---------------------------------------------------------------------------
// Environment setup for one scenario
// ---------------------------------------------------------------------------
function formatLogArg(arg: unknown): string {
  const text = typeof arg === 'string' ? arg : inspect(arg, { depth: 8, breakLength: Infinity });
  // Stack traces carry file paths and line numbers that change with any edit.
  // Stacks appear both as real lines and as escaped "\n    at ..." inside inspected objects.
  // The number of frames depends on how the code is layered, so collapse them.
  return text
    .replace(/(\n\s+at [^\n]*)+/g, '\n    at <stack>')
    .replace(/(\\n\s+at [^'"]*?(?=\\n|['"]|$))+/g, '\\n    at <stack>');
}

export function installWorld() {
  globalThis.__gwWorld = newWorld();
  const w = globalThis.__gwWorld;

  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_NOW);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`,
  );

  vi.stubGlobal('Deno', {
    env: { get: (key: string) => ENV[key] },
    serve: (handler: any) => {
      w.handler = handler;
    },
  });

  vi.stubGlobal('fetch', async (url: string, init: any = {}) => {
    const record: CallRecord = { kind: 'fetch', url: String(url), method: init.method ?? 'GET' };
    if (init.headers) record.headers = init.headers;
    if (typeof init.body === 'string') {
      const body = JSON.parse(init.body);
      if (body && typeof body === 'object' && 'timestamp' in body) body.timestamp = '<timestamp>';
      record.body = body;
    }
    w.calls.push(record);
    if (String(url).startsWith('https://ipapi.co/')) {
      const r = w.ipapi;
      if (r instanceof Error) throw r;
      return { ok: r.ok, status: r.ok ? 200 : 500, json: async () => r.body };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      w.logs.push(`${level}: ${args.map(formatLogArg).join(' ')}`);
    });
  }
  return w;
}

export function uninstallWorld() {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------
export function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://example.supabase.co/functions/v1/generateWorksheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export const USER_HEADERS = {
  Authorization: 'Bearer user-token',
  'x-forwarded-for': '203.0.113.7',
};

export async function readSse(response: Response) {
  const text = await response.text();
  const events: Array<{ event: string; data: unknown }> = [];
  const comments: string[] = [];
  for (const frame of text.split('\n\n')) {
    if (!frame.trim()) continue;
    if (frame.startsWith(':')) {
      comments.push(frame);
      continue;
    }
    const event = /^event: (.*)$/m.exec(frame)?.[1] ?? '';
    const data = /^data: (.*)$/m.exec(frame)?.[1];
    events.push({ event, data: data === undefined ? null : JSON.parse(data) });
  }
  return { events, comments };
}

export async function summariseResponse(response: Response) {
  const base = {
    status: response.status,
    contentType: response.headers.get('Content-Type'),
    cors: response.headers.get('Access-Control-Allow-Origin'),
    cacheControl: response.headers.get('Cache-Control'),
  };
  if ((response.headers.get('Content-Type') || '').startsWith('text/event-stream')) {
    return { ...base, sse: await readSse(response) };
  }
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { ...base, body };
}

/** Let detached background work (fire-and-forget notifications) settle. */
export async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Everything a scenario produced, in one snapshot-able object. */
export function record(response: unknown) {
  const w = world();
  return { response, calls: w.calls, logs: w.logs };
}
