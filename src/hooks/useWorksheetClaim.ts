import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { devWarn } from '@/utils/logger';

const STORAGE_KEY = 'edooqoo_unclaimed_worksheets';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ClaimStorage {
  worksheetIds: string[];
  timestamp: number;
  /** UUID of the anonymous Supabase user that owned these worksheets. Used by
   * the edge function to match `teacher_id = anonUserId` (in addition to
   * `teacher_id IS NULL`). */
  anonUserId?: string;
}

function readStorage(): ClaimStorage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClaimStorage;
    if (!parsed.timestamp || Date.now() - parsed.timestamp > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!Array.isArray(parsed.worksheetIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(data: ClaimStorage) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    devWarn('[useWorksheetClaim] localStorage write failed', e);
  }
}

/**
 * Mark a worksheet (generated while anonymous) as pending claim. After the
 * user signs up / logs in, claimPendingWorksheets() transfers ownership to
 * them via the claim-anonymous-worksheets edge function.
 */
export function markWorksheetForClaim(worksheetId: string, anonUserId?: string) {
  if (!worksheetId) return;
  const existing = readStorage();
  const ids = new Set<string>(existing?.worksheetIds ?? []);
  ids.add(worksheetId);
  writeStorage({
    worksheetIds: Array.from(ids),
    timestamp: Date.now(),
    anonUserId: anonUserId || existing?.anonUserId,
  });
}

export function getPendingClaimIds(): string[] {
  return readStorage()?.worksheetIds ?? [];
}

export function getPendingAnonUserId(): string | undefined {
  return readStorage()?.anonUserId;
}

export function clearClaims() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {/* ignore */}
}

/**
 * Call after a successful auth event. Returns the list of worksheet IDs that
 * were successfully transferred to the now-authenticated user, so callers can
 * redirect the user to the most relevant worksheet.
 */
export async function claimPendingWorksheets(): Promise<string[]> {
  const pending = getPendingClaimIds();
  const anonUserId = getPendingAnonUserId();
  if (pending.length === 0) return [];

  try {
    const { data, error } = await supabase.functions.invoke('claim-anonymous-worksheets', {
      body: { worksheetIds: pending, anonUserId },
    });
    if (error) {
      devWarn('[useWorksheetClaim] claim invoke error', error);
      return [];
    }
    const claimedIds: string[] = Array.isArray(data?.claimedIds) ? data.claimedIds : [];
    // Always clear storage after a successful invocation (whether 0 or N claimed)
    clearClaims();
    return claimedIds;
  } catch (e) {
    devWarn('[useWorksheetClaim] claim threw', e);
    return [];
  }
}

export function useWorksheetClaim() {
  const mark = useCallback((id: string, anonUserId?: string) => markWorksheetForClaim(id, anonUserId), []);
  const claim = useCallback(() => claimPendingWorksheets(), []);
  const get = useCallback(() => getPendingClaimIds(), []);
  const clear = useCallback(() => clearClaims(), []);
  return { markWorksheetForClaim: mark, claimPendingWorksheets: claim, getPendingClaimIds: get, clearClaims: clear };
}