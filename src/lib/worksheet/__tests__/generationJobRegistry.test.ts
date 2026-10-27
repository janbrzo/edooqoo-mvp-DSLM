import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RUNNING_TTL_MS,
  expireStaleRunningJobs,
  failGenerationJob,
  getActiveGenerationJobs,
  getPollableJobs,
  isJobResumed,
  startGenerationJob,
} from '../generationJobRegistry';
import { installBrowserStubs } from './browserStubs';

const STORAGE_KEY = 'edooqoo.activeWorksheetGenerations';

function startJob(overrides: Partial<Parameters<typeof startGenerationJob>[0]> = {}) {
  return startGenerationJob({ teacherId: 't1', topic: 'Past simple', origin: 'manual', ...overrides });
}

function ageJob(jobId: string, ms: number) {
  const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
  raw[jobId].startedAt = Date.now() - ms;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}

describe('generationJobRegistry: stale running jobs', () => {
  beforeEach(() => {
    installBrowserStubs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flips a stale running job to failed and emits the update event', () => {
    const job = startJob();
    ageJob(job.jobId, RUNNING_TTL_MS + 5_000);

    const events: unknown[] = [];
    window.addEventListener('edooqoo:generationJobUpdated', (e) => events.push((e as CustomEvent).detail));

    const flipped = expireStaleRunningJobs();

    expect(flipped).toHaveLength(1);
    expect(flipped[0].status).toBe('failed');
    expect(flipped[0].errorMessage).toMatch(/did not finish/);
    // The UI is fed by this event: without it the modal stays until a reload.
    expect(events).toHaveLength(1);
    expect(getActiveGenerationJobs()[0].status).toBe('failed');
  });

  it('keeps a recovery window so a late backend save can still be linked to its charge', () => {
    const job = startJob();
    ageJob(job.jobId, RUNNING_TTL_MS + 5_000);
    expireStaleRunningJobs();

    const [flipped] = getActiveGenerationJobs();
    expect(flipped.recoveryDeadlineAt).toBeGreaterThan(Date.now());
    expect(getPollableJobs().map((j) => j.jobId)).toEqual([job.jobId]);
  });

  it('never drops a stale running job when the registry is merely read', () => {
    const job = startJob();
    ageJob(job.jobId, RUNNING_TTL_MS + 60_000);

    const jobs = getActiveGenerationJobs();

    expect(jobs.map((j) => j.jobId)).toEqual([job.jobId]);
    expect(jobs[0].status).toBe('running');
  });

  it('leaves fresh running jobs alone and emits nothing', () => {
    startJob();
    const handler = vi.fn();
    window.addEventListener('edooqoo:generationJobUpdated', handler);

    expect(expireStaleRunningJobs()).toEqual([]);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('generationJobRegistry: failGenerationJob', () => {
  beforeEach(() => {
    installBrowserStubs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a recovery window by default (stream may still have saved a row)', () => {
    const job = startJob();
    const failed = failGenerationJob(job.jobId, 'Connection lost');
    expect(failed?.status).toBe('failed');
    expect(failed?.recoveryDeadlineAt).toBeGreaterThan(Date.now());
  });

  it('skips the recovery window for exits that never reached the backend', () => {
    const job = startJob();
    const failed = failGenerationJob(job.jobId, 'Audio failed', { allowRecovery: false });
    expect(failed?.status).toBe('failed');
    expect(failed?.errorMessage).toBe('Audio failed');
    expect(failed?.recoveryDeadlineAt).toBeNull();
    expect(getPollableJobs()).toEqual([]);
  });

  it('accepts the message-only signature without a job id', () => {
    startJob();
    const failed = failGenerationJob('Too long', undefined, { allowRecovery: false });
    expect(failed?.errorMessage).toBe('Too long');
    expect(failed?.recoveryDeadlineAt).toBeNull();
  });
});

describe('isJobResumed', () => {
  it('is false for a job started during this page load', () => {
    const pageLoadedAt = Date.now() - 1_000;
    expect(isJobResumed({ startedAt: Date.now() }, pageLoadedAt)).toBe(false);
  });

  it('is true for a job rehydrated from storage after a reload', () => {
    const pageLoadedAt = Date.now();
    expect(isJobResumed({ startedAt: pageLoadedAt - 90_000 }, pageLoadedAt)).toBe(true);
  });
});
