/**
 * v6.9.53 — Worksheet generation job registry.
 *
 * The generator is a long-running backend job streamed over SSE. Until v6.9.53
 * the in-progress state lived only in React component state, so a refresh or a
 * route change wiped the modal, the suggestion-used update, and (for auth
 * users) the token consumption callback. This registry persists the active
 * generation across reloads so a polling hook can finish the side effects once
 * the backend writes the worksheet row.
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
}

const STORAGE_KEY = 'edooqoo.activeWorksheetGeneration';
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

function read(): WorksheetGenerationJob | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorksheetGenerationJob;
    if (!parsed?.jobId || !parsed?.status) {
      ls.removeItem(STORAGE_KEY);
      return null;
    }
    const age = Date.now() - (parsed.startedAt ?? 0);
    if (parsed.status === 'running' && age > JOB_TTL_MS) {
      ls.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.status !== 'running' && age > COMPLETED_TTL_MS) {
      ls.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(job: WorksheetGenerationJob | null): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    if (job) {
      ls.setItem(STORAGE_KEY, JSON.stringify(job));
    } else {
      ls.removeItem(STORAGE_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: job }));
    }
  } catch {
    /* ignore quota */
  }
}

export interface StartJobInput {
  teacherId: string | null;
  studentId?: string | null;
  suggestionId?: string | null;
  topic: string;
  origin: WorksheetGenerationOrigin;
  requestId?: string | null;
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
  };
  write(job);
  return job;
}

export function getActiveGenerationJob(): WorksheetGenerationJob | null {
  return read();
}

export function patchGenerationJob(patch: Partial<WorksheetGenerationJob>): WorksheetGenerationJob | null {
  const current = read();
  if (!current) return null;
  const next: WorksheetGenerationJob = { ...current, ...patch, updatedAt: Date.now() };
  write(next);
  return next;
}

export function completeGenerationJob(worksheetId: string): WorksheetGenerationJob | null {
  const current = read();
  if (!current) return null;
  const next: WorksheetGenerationJob = {
    ...current,
    status: 'completed',
    worksheetId,
    updatedAt: Date.now(),
  };
  write(next);
  return next;
}

export function failGenerationJob(message: string): WorksheetGenerationJob | null {
  const current = read();
  if (!current) return null;
  const next: WorksheetGenerationJob = {
    ...current,
    status: 'failed',
    errorMessage: message,
    updatedAt: Date.now(),
  };
  write(next);
  return next;
}

export function markTokenConsumed(): WorksheetGenerationJob | null {
  return patchGenerationJob({ tokenConsumedAt: Date.now() });
}

export function markSuggestionUsed(): WorksheetGenerationJob | null {
  return patchGenerationJob({ suggestionMarkedAt: Date.now() });
}

export function clearGenerationJob(): void {
  write(null);
}

export function subscribeToGenerationJob(
  listener: (job: WorksheetGenerationJob | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorksheetGenerationJob | null>).detail ?? read();
    listener(detail);
  };
  const storageHandler = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    listener(read());
  };
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', storageHandler);
  };
}