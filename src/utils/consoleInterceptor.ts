/**
 * consoleInterceptor — captures the most recent client-side console errors
 * and warnings into a bounded ring buffer. Used by the bug-report modal so
 * teachers don't have to manually copy the dev console.
 *
 * Notes:
 * - Installed exactly once (idempotent).
 * - Does NOT intercept console.log/info/debug to avoid noise.
 * - Originals are preserved and still called.
 */

const MAX_ENTRIES = 50;
const STORAGE_KEY = '__edooqoo_console_errors__';

export interface ConsoleEntry {
  level: 'error' | 'warn';
  ts: string;
  message: string;
}

function safeStringify(arg: unknown): string {
  try {
    if (arg instanceof Error) return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack.slice(0, 800)}` : ''}`;
    if (typeof arg === 'string') return arg;
    return JSON.stringify(arg, (_k, v) => {
      if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + '…';
      return v;
    }) ?? String(arg);
  } catch {
    return String(arg);
  }
}

function getBuffer(): ConsoleEntry[] {
  // @ts-ignore — global ring buffer
  return (window as any)[STORAGE_KEY] ?? [];
}

function pushEntry(entry: ConsoleEntry) {
  const buf = getBuffer();
  buf.push(entry);
  if (buf.length > MAX_ENTRIES) buf.splice(0, buf.length - MAX_ENTRIES);
  // @ts-ignore
  (window as any)[STORAGE_KEY] = buf;
}

export function installConsoleInterceptor(): void {
  if (typeof window === 'undefined') return;
  // @ts-ignore
  if ((window as any).__edooqoo_console_interceptor_installed__) return;
  // @ts-ignore
  (window as any).__edooqoo_console_interceptor_installed__ = true;
  // @ts-ignore
  (window as any)[STORAGE_KEY] = [];

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    try {
      pushEntry({
        level: 'error',
        ts: new Date().toISOString(),
        message: args.map(safeStringify).join(' '),
      });
    } catch { /* never throw from logger */ }
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    try {
      pushEntry({
        level: 'warn',
        ts: new Date().toISOString(),
        message: args.map(safeStringify).join(' '),
      });
    } catch { /* never throw from logger */ }
    origWarn(...args);
  };

  // Capture unhandled errors and promise rejections too.
  window.addEventListener('error', (e) => {
    pushEntry({
      level: 'error',
      ts: new Date().toISOString(),
      message: `[unhandled] ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    pushEntry({
      level: 'error',
      ts: new Date().toISOString(),
      message: `[unhandledrejection] ${safeStringify(e.reason)}`,
    });
  });
}

export function getRecentConsoleErrors(): ConsoleEntry[] {
  return [...getBuffer()];
}

export function clearConsoleErrors(): void {
  // @ts-ignore
  (window as any)[STORAGE_KEY] = [];
}