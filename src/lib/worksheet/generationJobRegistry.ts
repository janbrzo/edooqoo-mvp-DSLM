/**
 * v6.9.53 — Worksheet generation job registry.
 * v6.9.58 — Refactored to a multi-job map so several concurrent generations
 * can each drive their own mini panel and survive page reloads. The legacy
 * single-job localStorage key is migrated on first read.
 */

export type WorksheetGenerationOrigin = 'manual' | 'dslm-auto' | 'anonymous';
export type WorksheetGenerationStatus = 'running' | 'completed' | 'failed';

export interface WorksheetGenerationJob {
  jobId: string;
  requestId: string | null;
  teacherId: string | null;
  studentId: string | null;
  suggestionId: string | null;
  topic: string;
  origin: WorksheetGenerationOrigin;
  startedAt: number;
  updatedAt: number;
  status: WorksheetGenerationStatus;
  worksheetId: string | null;
  tokenConsumedAt: number | null;
  suggestionMarkedAt: number | null;
  errorMessage: string | null;
  /**
   * v6.9.59 — sessionStorage-backed id of the tab that started this job.
   * The Index page only shows a full-screen modal for jobs whose
   * `originTabId` matches the current tab, so opening edooqoo.com in
   * another tab does not auto-open the modal there.
   */
  originTabId?: string | null;
  /**
   * v6.9.57 — Form metadata snapshot used to rehydrate the GeneratingModal
   * after a page refresh, so the modal can re-render with the same exercise
   * list / media flags / student label as the original attempt.
   * Worksheet generation prompt and engine are NOT derived from this.
   */
  formMeta?: {
    requiresAudio?: boolean;
    requiresImage?: boolean;
    hasGrammar?: boolean;
    selectedExercises?: string[];
    studentName?: string | null;
    studentEmail?: string | null;
  } | null;
  /**
   * v6.9.60 — Live per-job progress. Set from `useWorksheetGeneration` on
   * every SSE `progress` event so the modal switcher and mini-panel can
   * render correct values even when the active card is not the one
   * receiving live callbacks in this render.
   */
  progress?: {
    exercisesGenerated: number;
    expectedTotal: number;
    phase?: string;
  } | null;
}

const STORAGE_KEY_V2 = 'edooqoo.activeWorksheetGenerations'; // v6.9.58 multi-job map
const LEGACY_STORAGE_KEY = 'edooqoo.activeWorksheetGeneration'; // v6.9.53 single-job
const JOB_TTL_MS = 15 * 60 * 1000; // 15 minutes upper bound for any job
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000; // keep completed CTA for 24h

const EVENT_NAME = 'edooqoo:generationJobUpdated';

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

type JobMap = Record<string, WorksheetGenerationJob>;

function isExpired(job: WorksheetGenerationJob): boolean {
  const age = Date.now() - (job.startedAt ?? 0);
  if (job.status === 'running') return age > JOB_TTL_MS;
  return age > COMPLETED_TTL_MS;
}

function prune(map: JobMap): JobMap {
  const next: JobMap = {};
  for (const [id, job] of Object.entries(map)) {
    if (job?.jobId && job?.status && !isExpired(job)) next[id] = job;
  }
  return next;
}

function readMap(): JobMap {
  const ls = safeLocalStorage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(STORAGE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw) as JobMap;
      const pruned = prune(parsed || {});
      // Persist back if pruning trimmed anything (best-effort, ignore quota).
      if (Object.keys(pruned).length !== Object.keys(parsed || {}).length) {
        try { ls.setItem(STORAGE_KEY_V2, JSON.stringify(pruned)); } catch { /* ignore */ }
      }
      return pruned;
    }
    // v6.9.58 — migrate legacy single-job key if present.
    const legacyRaw = ls.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as WorksheetGenerationJob;
        ls.removeItem(LEGACY_STORAGE_KEY);
        if (legacy?.jobId && legacy?.status && !isExpired(legacy)) {
          const map: JobMap = { [legacy.jobId]: legacy };
          ls.setItem(STORAGE_KEY_V2, JSON.stringify(map));
          return map;
        }
      } catch { /* ignore */ }
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeMap(map: JobMap): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    if (Object.keys(map).length === 0) {
      ls.removeItem(STORAGE_KEY_V2);
    } else {
      ls.setItem(STORAGE_KEY_V2, JSON.stringify(map));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { jobs: Object.values(map) } }));
    }
  } catch {
    /* ignore quota */
  }
}

function pickLatestRunning(map: JobMap): WorksheetGenerationJob | null {
  const all = Object.values(map);
  const running = all.filter((j) => j.status === 'running').sort((a, b) => b.startedAt - a.startedAt);
  if (running[0]) return running[0];
  const sorted = all.sort((a, b) => b.startedAt - a.startedAt);
  return sorted[0] ?? null;
}

export interface StartJobInput {
  teacherId: string | null;
  studentId?: string | null;
  suggestionId?: string | null;
  topic: string;
  origin: WorksheetGenerationOrigin;
  requestId?: string | null;
  originTabId?: string | null;
  formMeta?: WorksheetGenerationJob['formMeta'];
}

export function startGenerationJob(input: StartJobInput): WorksheetGenerationJob {
  const now = Date.now();
  const jobId =
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID()) ||
    `job_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const job: WorksheetGenerationJob = {
    jobId,
    requestId: input.requestId ?? null,
    teacherId: input.teacherId ?? null,
    studentId: input.studentId ?? null,
    suggestionId: input.suggestionId ?? null,
    topic: input.topic,
    origin: input.origin,
    startedAt: now,
    updatedAt: now,
    status: 'running',
    worksheetId: null,
    tokenConsumedAt: null,
    suggestionMarkedAt: null,
    errorMessage: null,
    originTabId: input.originTabId ?? null,
    formMeta: input.formMeta ?? null,
  };
  const map = readMap();
  map[jobId] = job;
  writeMap(map);
  return job;
}

export function getActiveGenerationJobs(): WorksheetGenerationJob[] {
  return Object.values(readMap()).sort((a, b) => a.startedAt - b.startedAt);
}

/** Back-compat: returns the latest running job (or latest of any status). */
export function getActiveGenerationJob(): WorksheetGenerationJob | null {
  return pickLatestRunning(readMap());
}

function resolveJobId(map: JobMap, jobId?: string): string | null {
  if (jobId && map[jobId]) return jobId;
  const latest = pickLatestRunning(map);
  return latest?.jobId ?? null;
}

export function patchGenerationJob(
  patchOrJobId: Partial<WorksheetGenerationJob> | string,
  maybePatch?: Partial<WorksheetGenerationJob>,
): WorksheetGenerationJob | null {
  const map = readMap();
  const jobId = typeof patchOrJobId === 'string' ? patchOrJobId : undefined;
  const patch = (typeof patchOrJobId === 'string' ? maybePatch : patchOrJobId) || {};
  const targetId = resolveJobId(map, jobId);
  if (!targetId) return null;
  const next: WorksheetGenerationJob = { ...map[targetId], ...patch, updatedAt: Date.now() };
  map[targetId] = next;
  writeMap(map);
  return next;
}

export function completeGenerationJob(
  arg1: string,
  arg2?: string,
): WorksheetGenerationJob | null {
  // Signatures: completeGenerationJob(worksheetId)  // back-compat (latest job)
  //             completeGenerationJob(jobId, worksheetId)
  const map = readMap();
  let jobId: string | null;
  let worksheetId: string;
  if (typeof arg2 === 'string') {
    jobId = resolveJobId(map, arg1);
    worksheetId = arg2;
  } else {
    jobId = resolveJobId(map);
    worksheetId = arg1;
  }
  if (!jobId) return null;
  const next: WorksheetGenerationJob = {
    ...map[jobId],
    status: 'completed',
    worksheetId,
    updatedAt: Date.now(),
  };
  map[jobId] = next;
  writeMap(map);
  return next;
}

export function failGenerationJob(
  arg1: string,
  arg2?: string,
): WorksheetGenerationJob | null {
  // Signatures: failGenerationJob(message)  // back-compat
  //             failGenerationJob(jobId, message)
  const map = readMap();
  let jobId: string | null;
  let message: string;
  if (typeof arg2 === 'string') {
    jobId = resolveJobId(map, arg1);
    message = arg2;
  } else {
    jobId = resolveJobId(map);
    message = arg1;
  }
  if (!jobId) return null;
  const next: WorksheetGenerationJob = {
    ...map[jobId],
    status: 'failed',
    errorMessage: message,
    updatedAt: Date.now(),
  };
  map[jobId] = next;
  writeMap(map);
  return next;
}

export function markTokenConsumed(jobId?: string): WorksheetGenerationJob | null {
  return patchGenerationJob(jobId ?? '', { tokenConsumedAt: Date.now() }) || patchGenerationJob({ tokenConsumedAt: Date.now() });
}

export function markSuggestionUsed(jobId?: string): WorksheetGenerationJob | null {
  return patchGenerationJob(jobId ?? '', { suggestionMarkedAt: Date.now() }) || patchGenerationJob({ suggestionMarkedAt: Date.now() });
}

/**
 * Without args: clears all jobs (back-compat).
 * With jobId: removes that specific job.
 */
export function clearGenerationJob(jobId?: string): void {
  const map = readMap();
  if (!jobId) {
    writeMap({});
    return;
  }
  if (map[jobId]) {
    delete map[jobId];
    writeMap(map);
  }
}

/** Back-compat single-job subscription (latest running). */
export function subscribeToGenerationJob(
  listener: (job: WorksheetGenerationJob | null) => void,
): () => void {
  return subscribeToGenerationJobs((jobs) => {
    const running = jobs.filter((j) => j.status === 'running').sort((a, b) => b.startedAt - a.startedAt);
    listener(running[0] ?? jobs.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null);
  });
}

export function subscribeToGenerationJobs(
  listener: (jobs: WorksheetGenerationJob[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener(getActiveGenerationJobs());
  const storageHandler = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY_V2 && event.key !== LEGACY_STORAGE_KEY) return;
    listener(getActiveGenerationJobs());
  };
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', storageHandler);
  };
}