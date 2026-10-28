import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phase 1 / P1.5 (audit R14): extract_skill_category and extract_micro_skill gain fallback
 * rules for topics that used to map to 'other' (20261028111000). The rules of both SQL
 * functions are evaluated here from the migration text (first matching WHEN wins), so the
 * contract is checked without a database:
 *   1. a name that already had a real category or micro skill keeps it (additive);
 *   2. every name with a micro skill other than 'other' has a category other than 'other';
 *   3. the measured unmapped topics now map to a real category.
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');

const NEW_FILE = '20261028111000_extract_skill_category_fallbacks.sql';
const CATEGORY_BASELINE = read('20261012090000_dslm_pipeline_baseline.sql');
const MICRO_BASELINE = read('20261015201345_c5c1929e-6931-46d3-b7bd-444dbf6a607b.sql');
const NEW = read(NEW_FILE);

const fnText = (src: string, name: string): string => {
  const start = src.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'i'));
  expect(start, `${name} defined`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('$function$', start);
  return src.slice(open, src.indexOf('$function$', open + 10));
};

interface Rule { source: string; test: (name: string) => boolean; value: string; line: string }

const likeToRegExp = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '%' || c === '_' ? c : `\\${c}`)).replace(/%/g, '.*').replace(/_/g, '.')}$`);

const parseRules = (body: string): Rule[] => {
  const rules: Rule[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const m = line.match(/^WHEN skill_name (~|LIKE) '((?:[^']|'')*)' THEN '([a-z_]+)'$/);
    if (!m) continue;
    const re = m[1] === '~' ? new RegExp(m[2]) : likeToRegExp(m[2]);
    rules.push({ source: m[2], test: (n) => re.test(n), value: m[3], line });
  }
  return rules;
};

const evaluate = (rules: Rule[], name: string): string => rules.find((r) => r.test(name))?.value ?? 'other';

const oldCategory = parseRules(fnText(CATEGORY_BASELINE, 'extract_skill_category'));
const oldMicro = parseRules(fnText(MICRO_BASELINE, 'extract_micro_skill'));
const newCategory = parseRules(fnText(NEW, 'extract_skill_category'));
const newMicro = parseRules(fnText(NEW, 'extract_micro_skill'));

/** Sample names generated from the SQL patterns themselves (tiny regex expander). */
const expand = (pattern: string): string[] => {
  let i = 0;
  const cap = 400;
  const cross = (a: string[], b: string[]) => {
    const out: string[] = [];
    for (const x of a) for (const y of b) { out.push(x + y); if (out.length >= cap) return out; }
    return out;
  };
  const parseSeq = (): string[] => {
    let acc = [''];
    while (i < pattern.length && pattern[i] !== ')' && pattern[i] !== '|') {
      let unit: string[];
      const c = pattern[i];
      if (c === '(') {
        i++;
        const alts: string[] = [];
        for (;;) {
          alts.push(...parseSeq());
          if (pattern[i] === '|') { i++; continue; }
          break;
        }
        i++; // ')'
        unit = alts;
      } else if (c === '[') {
        const end = pattern.indexOf(']', i);
        const cls = pattern.slice(i, end + 1);
        i = end + 1;
        if (cls === '[ABC]') unit = ['B'];
        else if (cls === '[12]') unit = ['1'];
        else if (cls === '[\\._]') unit = ['.', '_'];
        else unit = ['x'];
      } else if (c === '\\') {
        unit = [pattern[i + 1]];
        i += 2;
      } else if (c === '.' && pattern[i + 1] === '*') {
        unit = ['x'];
        i += 2;
        acc = cross(acc, unit);
        continue;
      } else if (c === '$') {
        unit = [''];
        i++;
      } else if (c === '^') {
        i++;
        continue;
      } else {
        unit = [c];
        i++;
      }
      const q = pattern[i];
      if (q === '?') { unit = ['', ...unit]; i++; }
      else if (q === '+') { i++; }
      else if (q === '*') { unit = ['', ...unit]; i++; }
      acc = cross(acc, unit);
    }
    return acc;
  };
  return parseSeq();
};

const likeSamples = (pattern: string): string[] => [pattern.replace(/%/g, 'probe')];

const corpus = (() => {
  const names = new Set<string>();
  for (const rules of [oldCategory, oldMicro, newCategory, newMicro]) {
    for (const r of rules) {
      const bases = r.line.includes(' LIKE ') ? likeSamples(r.source) : expand(r.source);
      for (const b of bases) {
        names.add(b);
        names.add(`${b}.probe`);
        names.add(`${b}_probe`);
      }
    }
  }
  return [...names].filter((n) => n.length > 3);
})();

/** Topics measured in production (tags of created worksheets since 2026-06-01, category 'other'). */
const MEASURED_UNMAPPED = [
  'ns.B1.used_to.affirmative_form_past_tense', 'ns.B1.simple_present.describing_functions_benefits',
  'ns.B1.conditionals.first_conditional_future_in_if_clause', 'ns.B1.future_forms.be_going_to_intentions',
  'ns.A1.future.going_to_affirmative', 'ns.B1.paraphrasing.ago_to_present_perfect_for', 'ns.A1.modals.can_ability',
  'ns.B1.agreement_disagreement.acknowledge_point_context', 'ns.C1.narrative_tenses.past_continuous_background',
  'ns.A2.future_tenses.be_going_to_structure', 'ns.B1.conjunctions.as_long_as', 'ns.B1.error_correction.comparative_correct',
  'ns.B1.comparison.as_as_difficulty', 'ns.B1.matching.comparative_contrast_simpler', 'ns.B1.adverbs_of_sequence.finally',
  'ns.B1.preposition.as_classification', 'ns.A2.polite_requests.could_i_infinitive', 'ns.A1.imperative.negative_instruction',
  'ns.B1.verb_tense.future_simple_plan', 'ns.A1.agreement.direct_agreement_i_agree', 'ns.A1.disagreement.direct_disagreement_i_dont_think_so',
  'ns.B1.sentence_structure.noun_placement', 'ns.B2.past_perfect_continuous.duration_before_past',
  'ns.B2.noun_clauses.complement_of_adjective_that', 'ns.B1.conditional.type_1_hypothetical', 'ns.B1.adverbs.as_well',
  'ns.A1.functional_language.expressing_importance', 'ns.A2.collocation.take_a_break', 'ns.B2.idiomatic_expression.definition_comfort_zone',
  'ns.B1.suggestions.how_about_ing', 'ns.B1.question_formation.wh_word_do', 'ns.A1.adverbs_of_frequency.placement_with_imperative',
  'ns.C2.discourse_markers.causal_relationship', 'ns.B1.verb_patterns.promise_to_infinitive', 'ns.B1.present_perfect_simple.duration_since',
  'ns.B1.future_will.negative_prediction', 'ns.B1.time_expressions.after_that', 'ns.B1.infinitive.after_adjective',
  'ns.B1.linking_words.as_a_result', 'ns.C1.past_perfect_simple.prior_investment', 'ns.B1.phrase_verb.as_a_child',
  'ns.B1.wish_past_simple_regret_present', 'ns.B2.academic_writing.opinion_articulation', 'ns.B2.communication.explaining_complex_ideas',
  'ns.B1.comparative_adjective.error_redundant_more', 'ns.A1.expressions.polite_response_offering', 'ns.B2.future_passive.form',
  'ns.B2.future_perfect.form_and_use', 'ns.B2.future_present_continuous.fixed_arrangement', 'ns.B1.gerund_after_phrasal_verb',
  'ns.B1.hypothetical_situations.express_preferences', 'ns.B1.imperatives.after_let_us', 'ns.C1.past_continuous_interrupted_by_simple',
  'ns.C1.past_simple_state', 'ns.B1.personal_experience.impact_of_information', 'ns.A2.phrasal_verb.look_for', 'ns.A2.quantifiers.a_few',
  'ns.B1.simple_past.time_marker_identification', 'ns.B2.social_interactions.infer_relationships',
  'ns.B2.verb_adverb_collocation.personally_directs', 'ns.B1.verb_choice.captivate_meaning', 'ns.B1.verb_form.infinitive_after_to',
  'ns.A1.verb_forms.infinitive_after_need_to', 'ns.B2.wish_past.regret_expression', 'ns.B1.academic_reading.identifying_challenges',
];

describe('P1.5 tag mapping fallbacks: rule parsing', () => {
  it('reads the rules of all four function bodies', () => {
    expect(oldCategory.length).toBeGreaterThan(30);
    expect(oldMicro.length).toBeGreaterThan(100);
    expect(newCategory.length).toBeGreaterThan(oldCategory.length);
    expect(newMicro.length).toBeGreaterThan(oldMicro.length);
    expect(corpus.length).toBeGreaterThan(500);
  });

  it('keeps every earlier WHEN rule, in the same order (additive)', () => {
    for (const [before, after] of [[oldCategory, newCategory], [oldMicro, newMicro]] as const) {
      let cursor = -1;
      for (const rule of before) {
        const idx = after.findIndex((r, k) => k > cursor && r.line === rule.line);
        expect(idx, rule.line).toBeGreaterThan(cursor);
        cursor = idx;
      }
    }
  });

  it('adds new rules only in front of the final ELSE', () => {
    const cat = fnText(NEW, 'extract_skill_category');
    const mic = fnText(NEW, 'extract_micro_skill');
    expect(cat.lastIndexOf("ELSE 'other'")).toBeGreaterThan(cat.indexOf('v3 (Phase 1 / P1.5)'));
    expect(mic.lastIndexOf("ELSE 'other'")).toBeGreaterThan(mic.indexOf('v3 (Phase 1 / P1.5)'));
  });

  it('reuses existing micro values only (skill-clusters.csv stays valid)', () => {
    const oldValues = new Set(oldMicro.map((r) => r.value));
    const added = newMicro.slice(oldMicro.length).map((r) => r.value);
    expect(added.length).toBeGreaterThan(20);
    for (const v of added) expect(oldValues.has(v), v).toBe(true);
  });
});

describe('P1.5 tag mapping fallbacks: behaviour', () => {
  it('no name that already had a real category changes it', () => {
    for (const n of corpus) {
      const before = evaluate(oldCategory, n);
      if (before !== 'other') expect(evaluate(newCategory, n), n).toBe(before);
    }
  });

  it('no name that already had a real micro skill changes it', () => {
    for (const n of corpus) {
      const before = evaluate(oldMicro, n);
      if (before !== 'other') expect(evaluate(newMicro, n), n).toBe(before);
    }
  });

  it('every micro_skill other than other has a category other than other', () => {
    const gaps = corpus.filter((n) => evaluate(newMicro, n) !== 'other' && evaluate(newCategory, n) === 'other');
    expect(gaps).toEqual([]);
  });

  it('the old functions had the business and functional gap this migration closes', () => {
    const gaps = corpus.filter((n) => evaluate(oldMicro, n) !== 'other' && evaluate(oldCategory, n) === 'other');
    expect(gaps.some((n) => /business|telephon|negotiat|functional_language/.test(n))).toBe(true);
  });

  it.each(MEASURED_UNMAPPED)('%s maps to a real category and micro skill', (n) => {
    expect(evaluate(oldCategory, n)).toBe('other');
    expect(evaluate(newCategory, n)).not.toBe('other');
    expect(evaluate(newMicro, n)).not.toBe('other');
  });

  it('maps representative topics to the expected hierarchy', () => {
    const expected: Array<[string, string, string]> = [
      ['ns.B1.used_to.affirmative_form_past_tense', 'grammar', 'used_to_would'],
      ['ns.B1.conditionals.second_conditional_x', 'grammar', 'second_conditional'],
      ['ns.A1.future.going_to_affirmative', 'grammar', 'future_going_to'],
      ['ns.B1.paraphrasing.x', 'writing', 'writing'],
      ['ns.B1.agreement_disagreement.x', 'speaking', 'functional_language'],
      ['ns.A1.functional_language.expressing_opinion', 'speaking', 'functional_language'],
      ['ns.B2.business.email.formal_closing', 'writing', 'email_register'],
      ['ns.B2.business.negotiation.x', 'speaking', 'negotiation'],
      ['ns.B2.telephoning.x', 'speaking', 'telephoning'],
      ['ns.B2.business.x', 'speaking', 'business_communication'],
    ];
    for (const [n, cat, micro] of expected) {
      expect([evaluate(newCategory, n), evaluate(newMicro, n)], n).toEqual([cat, micro]);
    }
  });

  it('keeps unknown and test names in other', () => {
    for (const n of ['ns.QA.forged.skill_L2', 'ns.B1.foobar.baz']) {
      expect(evaluate(newCategory, n)).toBe('other');
      expect(evaluate(newMicro, n)).toBe('other');
    }
  });
});

describe('P1.5 data script and migration hygiene', () => {
  const script = readFileSync(join(__dirname, '../../../scripts/dslm/recompute-other-category-metrics.sql'), 'utf8');

  it('the recompute is a script outside supabase/migrations and goes through compute_skill_metric with a dry run and an audit', () => {
    expect(script).toMatch(/DRY RUN/);
    expect(script).toMatch(/public\.compute_skill_metric\(/);
    expect(script).toMatch(/skill_category = 'other' OR m\.micro_skill = 'other'/);
    expect(script).toMatch(/E_other_category_remap/);
    expect(script).not.toMatch(/\bDELETE\b/);
    expect(script).not.toMatch(/\bDROP\b/i);
  });

  it('the migration is CREATE OR REPLACE only and has no apostrophes in line comments', () => {
    expect(NEW).not.toMatch(/\bDROP\b/i);
    expect(NEW.match(/CREATE OR REPLACE FUNCTION public\.extract_(skill_category|micro_skill)\(/g)).toHaveLength(2);
    expect(NEW.split('\n').filter((l) => /^\s*--.*'/.test(l))).toEqual([]);
  });
});
