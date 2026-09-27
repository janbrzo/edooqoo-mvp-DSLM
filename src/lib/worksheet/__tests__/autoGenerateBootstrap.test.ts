import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAutoGeneratePayload,
  toEnglishLevelBand,
  writeAutoGenerateIntent,
} from '../autoGenerateBootstrap';

function memoryStorage(): Storage {
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

describe('toEnglishLevelBand', () => {
  it('maps CEFR levels to the generator bands like WorksheetForm does', () => {
    expect(toEnglishLevelBand('A1')).toBe('A1/A2');
    expect(toEnglishLevelBand('A2')).toBe('A1/A2');
    expect(toEnglishLevelBand('B1')).toBe('B1/B2');
    expect(toEnglishLevelBand('B2')).toBe('B1/B2');
    expect(toEnglishLevelBand('C1')).toBe('C1/C2');
    expect(toEnglishLevelBand('C2')).toBe('C1/C2');
  });

  it('accepts band values and tolerates case and whitespace', () => {
    expect(toEnglishLevelBand('C1/C2')).toBe('C1/C2');
    expect(toEnglishLevelBand(' b2 ')).toBe('B1/B2');
  });

  it('returns null for unknown or missing levels', () => {
    expect(toEnglishLevelBand('unknown')).toBeNull();
    expect(toEnglishLevelBand('')).toBeNull();
    expect(toEnglishLevelBand(null)).toBeNull();
    expect(toEnglishLevelBand(undefined)).toBeNull();
  });
});

describe('buildAutoGeneratePayload — student level', () => {
  beforeEach(() => {
    const localStorage = memoryStorage();
    vi.stubGlobal('window', { localStorage });
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the student's level for one-click generation", () => {
    writeAutoGenerateIntent({ studentId: 's1', topic: 'Past simple', studentEnglishLevel: 'A2' });
    expect(buildAutoGeneratePayload()?.englishLevel).toBe('A1/A2');
  });

  it('keeps the B1/B2 default when the level is unknown', () => {
    writeAutoGenerateIntent({ studentId: 's1', topic: 'Past simple', studentEnglishLevel: 'unknown' });
    expect(buildAutoGeneratePayload()?.englishLevel).toBe('B1/B2');
  });

  it('keeps the B1/B2 default for intents persisted without a level', () => {
    window.localStorage.setItem(
      'edooqoo.pendingWorksheetIntent',
      JSON.stringify({
        requestId: 'legacy-1',
        studentId: 's1',
        suggestionId: null,
        topic: 'Travel',
        goal: '',
        additionalInfo: '',
        grammarFocus: '',
        exercises: [],
        exerciseFocusMap: {},
        mediaTypes: [],
        createdAt: Date.now(),
        status: 'pending',
      }),
    );
    expect(buildAutoGeneratePayload()?.englishLevel).toBe('B1/B2');
  });
});
