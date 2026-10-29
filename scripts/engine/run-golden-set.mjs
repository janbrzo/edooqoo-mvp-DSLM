#!/usr/bin/env node
/**
 * Golden set runner: replays the 12 fixed forms of scripts/engine/golden-set.json
 * against the REAL generation pipeline, the same calls the browser makes:
 *   1. POST auth/v1/token?grant_type=password          (sign in)
 *   2. POST functions/v1/generate-image | generate-audio (only for media forms)
 *   3. POST functions/v1/format-worksheet-prompt        (buildPromptServiceFormData)
 *   4. POST functions/v1/generateWorksheet, enableStreaming true, SSE until `done`
 * One generation at a time, paced for the limiter (3/5 min, 5/15 min, 10/60 min per
 * IP), 429 backs off and retries (a 429 never creates a row). A transport failure
 * is NEVER retried (the server may still save the row and a retry would charge twice).
 *
 * Usage:
 *   EDOOQOO_TEST_EMAIL=... EDOOQOO_TEST_PASSWORD=... \
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... \
 *   node scripts/engine/run-golden-set.mjs --out <dir> [--only g01,g05] [--interval-sec 190]
 *        [--forms path] [--force] [--dry-run]
 *   node scripts/engine/run-golden-set.mjs --out <dir> --metrics-only   (no network, no credentials)
 *
 * Credentials come only from the environment (VITE_* may also come from ./.env).
 * Output per form: <out>/<id>/{request.json,prompt.txt,events.jsonl,final.json,result.json,media.json};
 * per run: <out>/metrics.json and <out>/SUMMARY.md. Nothing secret is written.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { aggregateMetrics, computeWorksheetMetrics, renderSummaryMarkdown } from './metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function parseArgs(argv) {
  const o = { interval: 190, only: null, forms: path.join(here, 'golden-set.json'), force: false, dry: false, metricsOnly: false, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--interval-sec') o.interval = Number(argv[++i]);
    else if (a === '--forms') o.forms = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '--dry-run') o.dry = true;
    else if (a === '--metrics-only') o.metricsOnly = true;
    else throw new Error(`Unknown argument ${a}`);
  }
  if (!o.out) throw new Error('--out <directory> is required');
  return o;
}

function loadDotEnv() {
  try {
    const text = fs.readFileSync(path.resolve(here, '../../.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* .env is optional */ }
}

/** Same shape as createFormDataForStorage in src/utils/promptFormatter.ts. */
export function formDataForStorage(form) {
  return {
    lessonTopic: form.lessonTopic,
    lessonGoal: form.lessonGoal,
    teachingPreferences: form.teachingPreferences || null,
    additionalInformation: form.additionalInformation || null,
    englishLevel: form.englishLevel || null,
    languageStyle: form.languageStyle || 3,
    lessonTime: form.lessonTime,
    selectedExercises: form.selectedExercises || [],
    exerciseFocusMap: form.exerciseFocusMap || null,
    selectedImage: form.selectedImage || null,
    selectedAudio: form.selectedAudio || null,
  };
}

/** Same shape as buildPromptServiceFormData in src/utils/promptFormatter.ts. */
export function promptServiceFormData(form) {
  return {
    lessonTopic: form.lessonTopic,
    lessonGoal: form.lessonGoal,
    englishLevel: form.englishLevel,
    languageStyle: form.languageStyle,
    teachingPreferences: form.teachingPreferences,
    additionalInformation: form.additionalInformation,
    selectedExercises: form.selectedExercises,
    exerciseFocusMap: form.exerciseFocusMap,
  };
}

const AUDIO_IDS = ['listening-comprehension', 'multiple-choice-audio', 'true-false-audio', 'fill-in-blanks-audio', 'answer-questions-audio'];
const PICTURE_IDS = ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'multiple-choice-picture'];
export const requiresAudio = (form) => (form.selectedExercises || []).some((e) => AUDIO_IDS.some((r) => e.includes(r)));
export const requiresImage = (form) => (form.selectedExercises || []).some((e) => PICTURE_IDS.some((r) => e.includes(r)));

class Http extends Error {
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

async function postJson(url, headers, body, label) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 300);
    throw new Http(res.status, `${label} HTTP ${res.status}: ${text}`, res.headers);
  }
  return res.json();
}

async function signIn(base, key, email, password) {
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: HTTP ${res.status}`);
  const j = await res.json();
  return { token: j.access_token, userId: j.user?.id ?? null, at: Date.now() };
}

/**
 * Streams generateWorksheet and parses SSE exactly like worksheetStreamService.ts
 * ("event: x\ndata: {...}\n\n"). Returns {done, error, events, timing}.
 */
async function streamGeneration(url, headers, body, { heartbeatMs = 45000, overallMs = 300000 } = {}) {
  const t0 = Date.now();
  const events = [];
  const ctl = new AbortController();
  let hb = null;
  let aborted = null;
  const arm = () => {
    clearTimeout(hb);
    hb = setTimeout(() => { aborted = 'heartbeat 45s silence'; ctl.abort(); }, heartbeatMs);
  };
  const overall = setTimeout(() => { aborted = `overall timeout ${overallMs / 1000}s`; ctl.abort(); }, overallMs);
  arm();
  let done = null;
  let error = null;
  let firstProgress = null;
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).slice(0, 300);
      throw new Http(res.status, `generateWorksheet HTTP ${res.status}: ${text}`, res.headers);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done: eof, value } = await reader.read();
      if (eof) break;
      arm();
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const ev of parts) {
        if (!ev.trim()) continue;
        const lines = ev.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event: '));
        const dataLine = lines.find((l) => l.startsWith('data: '));
        if (!eventLine || !dataLine) continue;
        const type = eventLine.replace('event: ', '').trim();
        let data;
        try { data = JSON.parse(dataLine.replace('data: ', '').trim()); } catch { continue; }
        const t = Date.now() - t0;
        events.push({ t_ms: t, event: type, data: type === 'done' ? { worksheetId: data.worksheetId } : data });
        if (type === 'progress' && firstProgress === null) firstProgress = t;
        if (type === 'done') done = data;
        if (type === 'error') error = data?.message || 'Stream error';
      }
    }
  } catch (e) {
    if (e instanceof Http) throw e;
    error = aborted ? `aborted: ${aborted}` : `transport: ${e.message}`;
  } finally {
    clearTimeout(hb);
    clearTimeout(overall);
  }
  if (!done && !error) error = 'stream ended without done/error event';
  return { done, error, events, timing: { total_ms: Date.now() - t0, first_progress_ms: firstProgress, sse_events: events.length } };
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function collect(outDir, forms) {
  const perForm = [];
  const okMetrics = [];
  for (const f of forms) {
    const dir = path.join(outDir, f.id);
    const result = readJson(path.join(dir, 'result.json')) || { status: 'not_run' };
    const final = readJson(path.join(dir, 'final.json'));
    let metrics = null;
    if (final?.worksheet) {
      metrics = computeWorksheetMetrics(final.worksheet, { formData: f.formData, timing: result.timing });
      okMetrics.push(metrics);
    }
    perForm.push({ id: f.id, label: f.label, media: f.media, status: result.status, worksheetId: final?.worksheetId ?? result.worksheetId ?? null, attempts: result.attempts ?? null, error: result.error ?? null, metrics });
  }
  const aggregate = aggregateMetrics(okMetrics, forms.length);
  writeJson(path.join(outDir, 'metrics.json'), { generated_at: new Date().toISOString(), aggregate, forms: perForm });
  fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), renderSummaryMarkdown(aggregate, 'Golden set summary'));
  return { perForm, aggregate };
}

async function main() {
  const opts = parseArgs(process.argv);
  loadDotEnv();
  const set = readJson(opts.forms);
  if (!set?.forms) throw new Error(`Cannot read forms from ${opts.forms}`);
  const forms = set.forms.filter((f) => !opts.only || opts.only.includes(f.id));
  fs.mkdirSync(opts.out, { recursive: true });

  if (opts.metricsOnly) {
    const { aggregate } = collect(opts.out, forms);
    log('metrics written', aggregate.worksheets, 'worksheets');
    return;
  }

  const base = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const email = process.env.EDOOQOO_TEST_EMAIL || '';
  const password = process.env.EDOOQOO_TEST_PASSWORD || '';

  if (opts.dry) {
    for (const f of forms) {
      const body = { prompt: '<from format-worksheet-prompt>', formData: formDataForStorage(f.formData), enableStreaming: true, userId: '<user id>' };
      log(f.id, f.label, 'media:', requiresAudio(f.formData) ? 'audio' : requiresImage(f.formData) ? 'image' : 'none');
      log('  prompt-service body:', JSON.stringify({ formData: promptServiceFormData(f.formData) }).slice(0, 220));
      log('  generate body keys:', Object.keys(body).join(','));
    }
    return;
  }
  if (!base || !key || !email || !password) {
    throw new Error('Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, EDOOQOO_TEST_EMAIL and EDOOQOO_TEST_PASSWORD');
  }

  let session = await signIn(base, key, email, password);
  log('signed in');
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, apikey: key });
  let lastStart = 0;

  for (const f of forms) {
    const dir = path.join(opts.out, f.id);
    if (!opts.force && readJson(path.join(dir, 'final.json'))) {
      log(f.id, 'already generated, skipping (use --force to redo)');
      continue;
    }
    if (Date.now() - session.at > 40 * 60 * 1000) session = await signIn(base, key, email, password);

    const wait = lastStart + opts.interval * 1000 - Date.now();
    if (wait > 0) { log(`pacing: waiting ${Math.round(wait / 1000)}s`); await sleep(wait); }

    const form = JSON.parse(JSON.stringify(f.formData));
    const result = { id: f.id, status: 'running', attempts: 0, started_at: new Date().toISOString() };
    try {
      // Media pre-generation exactly like src/services/mediaService.ts.
      const media = {};
      if (requiresAudio(form)) {
        const r = await postJson(`${base}/functions/v1/generate-audio`, authHeaders(), {
          topic: form.lessonTopic || 'general English lesson', englishLevel: form.englishLevel || 'B1/B2',
          lessonFocus: form.lessonGoal || '', additionalInformation: form.additionalInformation || '',
          grammarFocus: form.teachingPreferences || '', duration: 90,
        }, 'generate-audio');
        form.selectedAudio = r.audioData;
        media.audio = { id: r.audioData?.id, transcript: r.audioData?.transcript, duration: r.audioData?.duration, voice: r.audioData?.voice };
      }
      if (requiresImage(form)) {
        const r = await postJson(`${base}/functions/v1/generate-image`, authHeaders(), {
          topic: form.lessonTopic || 'general English lesson', englishLevel: form.englishLevel || 'B1/B2',
        }, 'generate-image');
        if (!r?.success || !r?.image) throw new Error('generate-image returned no image');
        form.selectedImage = r.image;
        media.image = { id: r.image?.id, description: r.image?.description, detailedDescription: r.image?.detailedDescription };
      }
      if (Object.keys(media).length) writeJson(path.join(dir, 'media.json'), media);

      const promptRes = await postJson(`${base}/functions/v1/format-worksheet-prompt`, authHeaders(), { formData: promptServiceFormData(form) }, 'format-worksheet-prompt');
      if (!promptRes?.prompt) throw new Error('format-worksheet-prompt returned no prompt');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'prompt.txt'), promptRes.prompt);

      const stored = formDataForStorage(form);
      stored.clientGenerationId = crypto.randomUUID();
      const body = { prompt: promptRes.prompt, formData: stored, studentId: null, enableStreaming: true, userId: session.userId };
      const redacted = { ...body, userId: '<user id>', formData: { ...stored, selectedAudio: stored.selectedAudio ? '<audio>' : null, selectedImage: stored.selectedImage ? '<image>' : null } };
      writeJson(path.join(dir, 'request.json'), redacted);

      let attempt = 0;
      let out = null;
      for (;;) {
        attempt += 1;
        result.attempts = attempt;
        lastStart = Date.now();
        try {
          out = await streamGeneration(`${base}/functions/v1/generateWorksheet`, authHeaders(), body);
          break;
        } catch (e) {
          if (e instanceof Http && e.status === 429 && attempt <= 8) {
            const ra = Number(e.headers?.get('retry-after'));
            const waitSec = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 900) : 300;
            log(f.id, `429 rate limited (attempt ${attempt}), waiting ${waitSec}s`);
            result.rate_limited = (result.rate_limited || 0) + 1;
            await sleep(waitSec * 1000);
            continue;
          }
          throw e;
        }
      }
      fs.writeFileSync(path.join(dir, 'events.jsonl'), out.events.map((e) => JSON.stringify(e)).join('\n') + '\n');
      result.timing = out.timing;
      if (out.done) {
        writeJson(path.join(dir, 'final.json'), out.done);
        result.status = 'ok';
        result.worksheetId = out.done.worksheetId;
        log(f.id, 'done', out.done.worksheetId, `${Math.round(out.timing.total_ms / 1000)}s`);
      } else {
        result.status = 'failed';
        result.error = out.error;
        log(f.id, 'FAILED', out.error);
      }
    } catch (e) {
      result.status = 'failed';
      result.error = e.message;
      result.http_status = e.status ?? null;
      log(f.id, 'FAILED', e.message);
    }
    result.finished_at = new Date().toISOString();
    writeJson(path.join(dir, 'result.json'), result);
  }

  const { perForm, aggregate } = collect(opts.out, forms);
  log('summary:', `${aggregate.worksheets}/${aggregate.forms_total} worksheets`, 'failures:', perForm.filter((p) => p.status !== 'ok').map((p) => `${p.id}:${p.status}`).join(',') || 'none');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e.message); process.exit(1); });
