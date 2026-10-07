import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { MODEL_REGISTRY, type ModelRegistryEntry } from '../../../supabase/functions/_shared/modelRegistry';
import {
  classifyLifecycle,
  classifyProbeStatus,
  daysUntil,
  escapeHtml,
  extractDates,
  extractJsonObject,
  extractRelevantText,
  findModelMentions,
  normaliseModelIds,
  pickAdvisorModel,
  renderAuditReportHtml,
  scanDeprecationText,
  shouldLogProbeFailure,
  shouldSendAuditEmail,
  stripHtml,
  summariseAudit,
  validateAdvisorRecommendations,
} from '../../../supabase/functions/_shared/modelAudit';

const NOW = new Date('2026-10-04T12:00:00Z');

function entry(overrides: Partial<Omit<ModelRegistryEntry, 'lifecycle'>> & { lifecycle?: Partial<ModelRegistryEntry['lifecycle']> } = {}): ModelRegistryEntry {
  const { lifecycle, ...rest } = overrides;
  return {
    id: 'gpt-4o-mini',
    provider: 'openai',
    role: 'chat-fallback',
    useCase: 'test',
    consumers: [],
    probe: 'openai-chat',
    ...rest,
    lifecycle: { shutdownDate: null, replacement: null, sourceUrl: 'x', verifiedAt: '2026-10-04', ...lifecycle },
  };
}

describe('classifyProbeStatus', () => {
  it('maps HTTP statuses to categories', () => {
    expect(classifyProbeStatus(200)).toBe('ok');
    expect(classifyProbeStatus(404)).toBe('deprecated');
    expect(classifyProbeStatus(410)).toBe('deprecated');
    expect(classifyProbeStatus(401)).toBe('auth');
    expect(classifyProbeStatus(403)).toBe('auth');
    expect(classifyProbeStatus(429)).toBe('rate_limited');
    expect(classifyProbeStatus(503)).toBe('server');
    expect(classifyProbeStatus(400)).toBe('client');
    expect(classifyProbeStatus(-1)).toBe('missing_key');
    expect(classifyProbeStatus(0)).toBe('network');
  });

  it('logs only failures that break live workflows', () => {
    expect(shouldLogProbeFailure('deprecated')).toBe(true);
    expect(shouldLogProbeFailure('auth')).toBe(true);
    expect(shouldLogProbeFailure('rate_limited')).toBe(true);
    expect(shouldLogProbeFailure('server')).toBe(true);
    expect(shouldLogProbeFailure('client')).toBe(false);
    expect(shouldLogProbeFailure('missing_key')).toBe(false);
    expect(shouldLogProbeFailure('ok')).toBe(false);
  });
});

describe('shouldSendAuditEmail', () => {
  it('stays silent on a clean daily run and mails on failures, near shutdowns or monthly runs', () => {
    expect(shouldSendAuditEmail('daily', { failed: 0, shutdownCrit: 0 })).toBe(false);
    expect(shouldSendAuditEmail('daily', { failed: 1, shutdownCrit: 0 })).toBe(true);
    expect(shouldSendAuditEmail('daily', { failed: 0, shutdownCrit: 1 })).toBe(true);
    expect(shouldSendAuditEmail('daily', { failed: 2, shutdownCrit: 3 })).toBe(true);
    expect(shouldSendAuditEmail('monthly', { failed: 0, shutdownCrit: 0 })).toBe(true);
    expect(shouldSendAuditEmail('monthly', { failed: 3, shutdownCrit: 1 })).toBe(true);
  });
});

describe('lifecycle countdown', () => {
  it('counts whole UTC days', () => {
    expect(daysUntil('2026-10-05', NOW)).toBe(1);
    expect(daysUntil('2026-10-04', NOW)).toBe(0);
    expect(daysUntil('2026-12-11', NOW)).toBe(68);
  });

  it('applies warn/crit thresholds', () => {
    const at = (d: number) => {
      const t = new Date(Date.UTC(2026, 9, 4) + d * 86_400_000).toISOString().slice(0, 10);
      return classifyLifecycle({ shutdownDate: t, replacement: null, sourceUrl: 'x', verifiedAt: 'x' }, NOW).level;
    };
    expect(at(121)).toBe('ok');
    expect(at(120)).toBe('warn');
    expect(at(31)).toBe('warn');
    expect(at(30)).toBe('crit');
    expect(at(0)).toBe('crit');
    expect(at(-1)).toBe('past');
    expect(classifyLifecycle({ shutdownDate: null, replacement: null, sourceUrl: 'x', verifiedAt: 'x' }, NOW))
      .toEqual({ level: 'none', daysToShutdown: null });
  });
});

describe('extractDates', () => {
  it('parses ISO, short and long month forms', () => {
    expect(extractDates('on 2026-12-11 and Dec 11, 2026 and December 11th, 2026 and Sept 3, 2027 and Jan 6 2027'))
      .toEqual(['2026-12-11', '2026-12-11', '2026-12-11', '2027-09-03', '2027-01-06']);
  });
});

describe('findModelMentions', () => {
  it('matches whole tokens and dated snapshots only', () => {
    const text = 'gpt-4o-mini-tts and gpt-4o-mini-2024-07-18 and gpt-4o-mini. Also xgpt-4o-mini';
    const hits = findModelMentions(text, 'gpt-4o-mini').map((s) => text.slice(s.start, s.end));
    expect(hits).toEqual(['gpt-4o-mini-2024-07-18', 'gpt-4o-mini']);
  });

  it('does not treat a version dot as a sentence end', () => {
    expect(findModelMentions('gemini-2.5-flash.1', 'gemini-2.5-flash')).toHaveLength(0);
  });
});

describe('scanDeprecationText', () => {
  const openaiPage =
    'Shutdown date Model / system Recommended replacement Dec 11, 2026 gpt-5-2025-08-07 gpt-5.6-sol ' +
    'Dec 11, 2026 gpt-5-mini-2025-08-07 gpt-5.6-terra Jan 6, 2027 tts-1 gpt-realtime-2.1-mini';
  const geminiPage =
    'Model Release date Shutdown date Recommended replacement gemini-2.5-flash June 17, 2025 No shutdown date announced ' +
    'gemini-2.5-flash-image October 2, 2025 October 2, 2026 gemini-3.1-flash-image-preview';

  it('reports known when the registry already has the date', () => {
    const r = scanDeprecationText(openaiPage, entry({ id: 'gpt-5-mini-2025-08-07', lifecycle: { shutdownDate: '2026-12-11' } }), NOW);
    expect(r.status).toBe('known');
    expect(r.registryDateFound).toBe(true);
  });

  it('flags a new date the registry does not know', () => {
    const r = scanDeprecationText(openaiPage, entry({ id: 'tts-1' }), NOW);
    expect(r.status).toBe('flag');
    expect(r.unacknowledgedDates).toEqual(['2027-01-06']);
    expect(r.snippet).toContain('tts-1');
  });

  it('flags a registry date that disappeared from the page', () => {
    const r = scanDeprecationText(openaiPage, entry({ id: 'tts-1', lifecycle: { shutdownDate: '2026-11-01' } }), NOW);
    expect(r.status).toBe('flag');
    expect(r.registryDateFound).toBe(false);
  });

  it('gives a model that only appears as a replacement no date', () => {
    const page =
      'Oct 23, 2026 ft-o4-mini-2025-04-16 gpt-5.6-terra Oct 23, 2026 o4-mini | o4-mini-2025-04-16 gpt-5.6-terra Dec 11, 2026 gpt-5-mini-2025-08-07 gpt-5.6-terra';
    const r = scanDeprecationText(page, entry({ id: 'gpt-5.6-terra' }), NOW);
    expect(r.status).toBe('clear');
    expect(r.futureDates).toEqual([]);
  });

  it('attributes the row date to every model in a "|" / "," subject list', () => {
    const page = 'Oct 23, 2026 gpt-4-turbo | gpt-4-turbo-2024-04-09 , gpt-4-turbo-completions gpt-5.6-sol Dec 1, 2026 other-model';
    for (const id of ['gpt-4-turbo', 'gpt-4-turbo-completions']) {
      const r = scanDeprecationText(page, entry({ id }), NOW);
      expect(r.futureDates).toEqual(['2026-10-23']);
    }
    expect(scanDeprecationText(page, entry({ id: 'gpt-5.6-sol' }), NOW).futureDates).toEqual([]);
  });

  it('does not attribute the next row date to a Gemini model', () => {
    const r = scanDeprecationText(geminiPage, entry({ id: 'gemini-2.5-flash', provider: 'google' }), NOW);
    expect(r.status).toBe('clear');
    expect(r.mentioned).toBe(true);
  });

  it('respects acknowledged dates', () => {
    const page = 'gemini-3.1-flash-image May 28, 2026 May 28, 2027 or later gemini-2.5-flash-image';
    const r = scanDeprecationText(page, entry({ id: 'gemini-3.1-flash-image', provider: 'google-vertex', lifecycle: { acknowledgedDates: ['2027-05-28'] } }), NOW);
    expect(r.status).toBe('known');
  });

  it('is clear when the model is not mentioned', () => {
    expect(scanDeprecationText(openaiPage, entry({ id: 'gpt-4.1-2025-04-14' }), NOW).status).toBe('clear');
  });
});

describe('text helpers', () => {
  it('strips scripts, tags and entities', () => {
    expect(stripHtml('<p>a&nbsp;&amp;<script>x()</script> <b>b</b></p>')).toBe('a & b');
  });

  it('escapes HTML', () => {
    expect(escapeHtml('<img src=x onerror="a">')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;');
  });

  it('extracts merged keyword windows within a cap', () => {
    const text = 'aaaa Flash bbbb Flash cccc ' + 'z'.repeat(500) + ' Flash dddd';
    const out = extractRelevantText(text, ['Flash'], 5, 1000);
    expect(out).toContain('Flash bbbb Flash');
    expect(out).toContain(' … ');
    expect(extractRelevantText(text, ['Flash'], 5, 10).length).toBeLessThanOrEqual(10);
  });

  it('normalises provider resource names', () => {
    expect(normaliseModelIds(['models/gemini-3.8-flash', 'publishers/google/models/gemini-3.1-flash-image', 'gpt-4o-mini', 'gpt-4o-mini']))
      .toEqual(['gemini-3.8-flash', 'gemini-3.1-flash-image', 'gpt-4o-mini']);
  });

  it('extracts JSON from fenced or chatty responses', () => {
    expect(extractJsonObject('Sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('prefix {"b":[1]} suffix')).toEqual({ b: [1] });
    expect(extractJsonObject('no json')).toBeNull();
  });
});

describe('pickAdvisorModel', () => {
  it('picks the newest stable Flash model', () => {
    expect(pickAdvisorModel(['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.10-flash-preview', 'gemini-3.7-flash', 'gemini-3.8-flash-lite'], 'fb'))
      .toBe('gemini-3.8-flash');
    expect(pickAdvisorModel([], 'gemini-2.5-flash')).toBe('gemini-2.5-flash');
  });
});

describe('validateAdvisorRecommendations', () => {
  const entries = [
    entry({ id: 'gpt-4o-mini', role: 'chat-fallback' }),
    entry({ id: 'gpt-5-mini-2025-08-07', role: 'worksheet-json-fallback', protectedEngine: true }),
    entry({ id: 'gemini-2.5-flash-lite', provider: 'google', role: 'chat-lightweight' }),
  ];
  const available = { openai: ['gpt-4o-mini', 'gpt-5.6-terra'], google: ['gemini-3.5-flash-lite'], 'google-vertex': null };

  it('returns one recommendation per entry and validates suggestions', () => {
    const recs = validateAdvisorRecommendations({
      recommendations: [
        { role: 'chat-fallback', verdict: 'switch', suggestedModel: 'gpt-9-imaginary', reason: 'x', confidence: 'high' },
        { role: 'worksheet-json-fallback', verdict: 'switch', suggestedModel: 'gpt-5.6-terra', migrationEffort: 'drop-in', confidence: 'medium' },
        { role: 'unknown-role', verdict: 'switch', suggestedModel: 'x' },
      ],
    }, entries, available);

    expect(recs.map((r) => r.role)).toEqual(['chat-fallback', 'worksheet-json-fallback', 'chat-lightweight']);
    expect(recs[0].verdict).toBe('evaluate');
    expect(recs[0].validationNotes.join(' ')).toContain('not in the live openai model list');
    expect(recs[1].verdict).toBe('switch');
    expect(recs[1].validationNotes.join(' ')).toContain('update the Worksheet Generation Engine');
    expect(recs[2].verdict).toBe('keep');
    expect(recs[2].confidence).toBe('low');
    expect(recs[2].validationNotes[0]).toContain('no recommendation');
  });

  it('normalises self-suggestions, missing suggestions, previews and bad enums', () => {
    const recs = validateAdvisorRecommendations({
      recommendations: [
        { role: 'chat-fallback', verdict: 'switch', suggestedModel: 'gpt-4o-mini' },
        { role: 'worksheet-json-fallback', verdict: 'switch', suggestedModel: null },
        { role: 'chat-lightweight', verdict: 'bogus', suggestedModel: 'gemini-3.5-flash-lite-preview', confidence: 'certain' },
      ],
    }, entries, { ...available, google: ['gemini-3.5-flash-lite-preview'] });
    expect(recs[0].verdict).toBe('keep');
    expect(recs[0].suggestedModel).toBeNull();
    expect(recs[1].verdict).toBe('evaluate');
    expect(recs[2].verdict).toBe('evaluate');
    expect(recs[2].confidence).toBe('low');
    expect(recs[2].validationNotes.join(' ')).toContain('preview');
  });

  it('survives garbage input', () => {
    expect(validateAdvisorRecommendations('nope', entries, available).every((r) => r.verdict === 'keep')).toBe(true);
  });
});

describe('renderAuditReportHtml', () => {
  it('escapes provider and LLM text and summarises counts', () => {
    const input = {
      mode: 'monthly' as const,
      probes: [{ provider: 'openai', model: 'gpt-4o-mini', role: 'r', purpose: 'p', probe: 'openai-chat', status: 401, latency_ms: 5, error: '<script>alert(1)</script>', category: 'auth' as const, ok: false }],
      lifecycle: [{ provider: 'openai', model: 'tts-1', role: 'tts', shutdownDate: '2026-10-20', replacement: 'x', note: null, status: { level: 'crit' as const, daysToShutdown: 16 }, protectedEngine: false }],
      deprecationScan: [],
      advisor: { model: 'gemini-3.8-flash', error: null, recommendations: validateAdvisorRecommendations({ recommendations: [{ role: 'chat-fallback', verdict: 'switch', suggestedModel: 'gpt-5.6-terra', reason: '<b>cheaper</b>' }] }, [entry()], { openai: ['gpt-5.6-terra'] }) },
      unregistered: [],
    };
    const html = renderAuditReportHtml(input);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;cheaper&lt;/b&gt;');
    expect(html).toContain('SWITCH');
    expect(summariseAudit(input)).toMatchObject({ total: 1, ok: 0, failed: 1, shutdownCrit: 1, switchSuggestions: 1 });
  });
});

describe('MODEL_REGISTRY integrity', () => {
  it('has unique roles and valid ISO dates', () => {
    const roles = MODEL_REGISTRY.map((e) => e.role);
    expect(new Set(roles).size).toBe(roles.length);
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const e of MODEL_REGISTRY) {
      expect(e.lifecycle.verifiedAt).toMatch(iso);
      if (e.lifecycle.shutdownDate) expect(e.lifecycle.shutdownDate).toMatch(iso);
      for (const d of e.lifecycle.acknowledgedDates ?? []) expect(d).toMatch(iso);
    }
  });

  it('covers every model id hardcoded in supabase/functions', () => {
    const root = join(__dirname, '../../../supabase/functions');
    const skip = new Set(['audit-llm-models', 'test-model-failure-logger', 'mcp']);
    // Strings that look like model ids but are labels or aliases rewritten to a registry model.
    const ignored = new Set(['gemini-3.1-flash-image-preview']);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (!skip.has(name)) walk(p);
        } else if (p.endsWith('.ts') && !p.endsWith('modelRegistry.ts') && !p.endsWith('modelAudit.ts')) {
          files.push(p);
        }
      }
    };
    walk(root);
    const registered = new Set(MODEL_REGISTRY.map((e) => e.id));
    const missing = new Set<string>();
    const re = /["'`](?:google\/|openai\/)?(gpt-[\w.-]+|gemini-[\w.-]+|whisper-\d|tts-1(?:-hd)?|o[1-9]-[\w.-]+)["'`]/g;
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(re)) {
        if (!registered.has(m[1]) && !ignored.has(m[1])) missing.add(`${m[1]} (${f.slice(root.length + 1)})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
