import { vi } from 'vitest';

/** In-memory Storage used by the node-environment worksheet tests. */
export function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

/**
 * Installs `window` (an EventTarget carrying localStorage/sessionStorage) plus
 * the matching globals. Returns the storages so a test can seed or inspect
 * them. Call `vi.unstubAllGlobals()` in afterEach.
 */
export function installBrowserStubs(): { localStorage: Storage; sessionStorage: Storage; window: EventTarget } {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const target = new EventTarget();
  const win = Object.assign(target, { localStorage, sessionStorage });
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('sessionStorage', sessionStorage);
  return { localStorage, sessionStorage, window: target };
}
