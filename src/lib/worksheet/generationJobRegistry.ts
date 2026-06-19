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
    /** v6.9.64 — optional smooth percent emitted by SSE or computed by UI. */
    percent?: number;
  } | null;
  /**
   * v6.9.61 — Epoch ms after which a `failed` job is no longer pollable for
   * background recovery. Set when `failGenerationJob` flips a job to failed
   * (default: now + 60 s). Cancellations explicitly clear this (null) so the
   * poller does not try to "recover" a user-aborted run.
   */
  recoveryDeadlineAt?: number | null;
}

const STORAGE_KEY_V2 = 'edooqoo.activeWorksheetGenerations'; // v6.9.58 multi-job map
const LEGACY_STORAGE_KEY = 'edooqoo.activeWorksheetGeneration'; // v6.9.53 single-job
// v6.9.61 — Hard backend timeout for `running` jobs. After this window, the
// global poller flips them to `failed` with a clear timeout message so the
// modal/mini-panel doesn't spin forever when the backend actually crashed.
const RUNNING_TTL_MS = 4 * 60 * 1000; // 4 minutes
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000; // keep completed CTA for 24h
const RECOVERY_WINDOW_MS = 60 * 1000; // failed → DB-poll recovery grace

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
  if (job.status === 'running') return age > RUNNING_TTL_MS;
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
    // v6.9.61 — open a recovery window so the global DB poller can still
    // promote this job back to `completed` if the backend (running via
    // EdgeRuntime.waitUntil) saves the worksheet within RECOVERY_WINDOW_MS.
    recoveryDeadlineAt: Date.now() + RECOVERY_WINDOW_MS,
  };
  map[jobId] = next;
  writeMap(map);
  return next;
}

/**
 * v6.9.61 — Promote a `failed` job back to `completed` after the DB poller
 * located the worksheet that was saved in the background. Idempotent —
 * returns null if jobId is unknown.
 */
export function recoverJobToCompleted(
  jobId: string,
  worksheetId: string,
): WorksheetGenerationJob | null {
  const map = readMap();
  if (!map[jobId]) return null;
  const next: WorksheetGenerationJob = {
    ...map[jobId],
    status: 'completed',
    worksheetId,
    errorMessage: null,
    recoveryDeadlineAt: null,
    updatedAt: Date.now(),
  };
  map[jobId] = next;
  writeMap(map);
  return next;
}

/**
 * v6.9.61 — Joblist eligible for DB polling: still running, OR recently
 * failed but inside the recovery window (backend may still save).
 */
export function getPollableJobs(): WorksheetGenerationJob[] {
  const now = Date.now();
  return Object.values(readMap()).filter((j) => {
    if (j.status === 'running') return true;
    if (j.status === 'failed' && j.recoveryDeadlineAt && now < j.recoveryDeadlineAt) return true;
    return false;
  });
}

/**
 * v6.9.61 — Flip `running` jobs older than RUNNING_TTL_MS to `failed` with a
 * timeout message. Called periodically from the global poller so a dead
 * backend does not leave a spinner forever. Returns the jobs that flipped.
 */
export function expireStaleRunningJobs(): WorksheetGenerationJob[] {
  const map = readMap();
  const flipped: WorksheetGenerationJob[] = [];
  const now = Date.now();
  for (const [id, job] of Object.entries(map)) {
    if (job.status === 'running' && now - (job.startedAt ?? now) > RUNNING_TTL_MS) {
      map[id] = {
        ...job,
        status: 'failed',
        errorMessage: 'Backend did not respond within 4 minutes. No tokens were consumed.',
        recoveryDeadlineAt: null, // hard timeout — no recovery
        updatedAt: now,
      };
      flipped.push(map[id]);
    }
  }
  if (flipped.length > 0) writeMap(map);
  return flipped;
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