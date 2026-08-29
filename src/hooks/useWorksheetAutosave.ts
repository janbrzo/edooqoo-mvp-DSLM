/**
 * useWorksheetAutosave — P1.4
 *
 * Root cause it fixes: worksheet edits lived only in React state + sessionStorage,
 * while students and the share link read from the database. Teachers assumed
 * "it saves itself" and shared stale worksheets.
 *
 * Contract:
 * - Debounced (2.5s) persistence of `worksheet` through `updateWorksheetAPI`
 *   (the single write path — it keeps `ai_response`, `title` and `html_content` in sync).
 * - Hard early returns: no worksheetId, no userId (anonymous), demo mode, disabled.
 * - "Last write wins": while a save is in flight, further changes are queued and
 *   flushed once the current request settles.
 * - `flush()` forces an immediate save (used by manual Save and before sharing).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { updateWorksheetAPI } from '@/services/worksheetService/updateService';
import { devLog, devWarn } from '@/utils/logger';

export type AutosaveStatus = 'disabled' | 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Options {
  worksheetId?: string | null;
  userId?: string | null;
  worksheet: any;
  /** Set to false to suspend autosave (e.g. read-only views). */
  enabled?: boolean;
  debounceMs?: number;
}

const isDemoMode = () => {
  try {
    return localStorage.getItem('edooqoo_demo_mode') === 'true';
  } catch {
    return false;
  }
};

export function useWorksheetAutosave({
  worksheetId,
  userId,
  worksheet,
  enabled = true,
  debounceMs = 2500,
}: Options) {
  const active = Boolean(enabled && worksheetId && userId) && !isDemoMode();

  const [status, setStatus] = useState<AutosaveStatus>(active ? 'idle' : 'disabled');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const savedSnapshotRef = useRef<string | null>(null);
  const pendingSnapshotRef = useRef<string | null>(null);
  const latestWorksheetRef = useRef<any>(worksheet);
  const isSavingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestWorksheetRef.current = worksheet;

  const serialize = (value: any) => {
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return null;
    }
  };

  const persist = useCallback(async (): Promise<boolean> => {
    if (!active || !worksheetId || !userId) return false;

    const snapshot = serialize(latestWorksheetRef.current);
    if (!snapshot || snapshot === 'null') return false;
    if (snapshot === savedSnapshotRef.current) {
      setStatus('saved');
      return true;
    }

    if (isSavingRef.current) {
      // Last write wins — remember that another save is needed.
      pendingSnapshotRef.current = snapshot;
      return false;
    }

    isSavingRef.current = true;
    setStatus('saving');

    try {
      await updateWorksheetAPI(worksheetId, latestWorksheetRef.current, userId);
      savedSnapshotRef.current = snapshot;
      setLastSavedAt(new Date());
      setStatus('saved');
      devLog('[autosave] Worksheet persisted', worksheetId);
      return true;
    } catch (err) {
      devWarn('[autosave] Failed to persist worksheet', err);
      setStatus('error');
      return false;
    } finally {
      isSavingRef.current = false;
      if (pendingSnapshotRef.current && pendingSnapshotRef.current !== savedSnapshotRef.current) {
        pendingSnapshotRef.current = null;
        void persist();
      } else {
        pendingSnapshotRef.current = null;
      }
    }
  }, [active, worksheetId, userId]);

  // Baseline: the first worksheet we see is considered already persisted.
  useEffect(() => {
    savedSnapshotRef.current = serialize(worksheet);
    setStatus(active ? 'idle' : 'disabled');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheetId, active]);

  // Debounced autosave on every change.
  useEffect(() => {
    if (!active) return;
    const snapshot = serialize(worksheet);
    if (!snapshot || snapshot === savedSnapshotRef.current) return;

    setStatus((prev) => (prev === 'saving' ? prev : 'dirty'));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [worksheet, active, debounceMs, persist]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!active) return false;
    return persist();
  }, [active, persist]);

  const hasUnsavedChanges =
    active && serialize(worksheet) !== savedSnapshotRef.current;

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!active || !hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active, hasUnsavedChanges]);

  /** Lets external save paths (manual Save) mark the current state as persisted. */
  const markSaved = useCallback(() => {
    savedSnapshotRef.current = serialize(latestWorksheetRef.current);
    setLastSavedAt(new Date());
    setStatus('saved');
  }, []);

  return { status, lastSavedAt, hasUnsavedChanges, flush, markSaved, isActive: active };
}
