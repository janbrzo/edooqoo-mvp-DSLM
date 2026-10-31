import { useCallback, useEffect, useRef, useState } from 'react';
import { useDemoContext } from '@/contexts/DemoContext';
import { requestMistakeFlashcards, type MistakeScope, type MistakeSaveResult } from '@/lib/homework/mistakeFlashcardsApi';

type Result = { key: string; status: 'loading' | 'ready' | 'error' | 'saving'; count: number; saved?: MistakeSaveResult };
export function useHomeworkMistakeFlashcards(scope: MistakeScope | null) {
  const { isDemoMode } = useDemoContext();
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const flight = useRef(false);
  const key = scope && !isDemoMode && !localStorage.getItem('edooqoo_demo_mode') ? JSON.stringify(scope) : '';
  const currentKey = useRef(key);
  currentKey.current = key;
  useEffect(() => {
    flight.current = false;
    if (!key || !scope) { setResult(null); return; }
    let cancelled = false;
    setResult({ key, status: 'loading', count: 0 });
    requestMistakeFlashcards(scope, 'preview').then(data => {
      if (!cancelled && currentKey.current === key && !localStorage.getItem('edooqoo_demo_mode')) setResult({ key, status: 'ready', count: data.count });
    }).catch(() => { if (!cancelled && currentKey.current === key) setResult({ key, status: 'error', count: 0 }); });
    return () => { cancelled = true; currentKey.current = ''; };
  }, [key, attempt]);
  const create = useCallback(async () => {
    if (!scope || !key || isDemoMode || localStorage.getItem('edooqoo_demo_mode') || flight.current || result?.key !== key || result.status !== 'ready' || !result.count) return null;
    flight.current = true;
    setResult({ ...result, status: 'saving' });
    try {
      const saved = await requestMistakeFlashcards(scope, 'create');
      if (currentKey.current !== key || localStorage.getItem('edooqoo_demo_mode')) return null;
      setResult({ key, status: 'ready', count: result.count, saved });
      return saved;
    } catch {
      if (currentKey.current === key) setResult({ key, status: 'error', count: 0 });
      return null;
    } finally { if (currentKey.current === key) flight.current = false; }
  }, [scope, key, isDemoMode, result]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { result: key && result?.key === key ? result : null, create, retry };
}