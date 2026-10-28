-- Phase 1 / P1.5 (audit R14, SQL part): tag mapping fallbacks.
--
-- PROBLEM: about 2.6 percent of nano_skill tags created since 2026-06 (438 of 16824) had
-- topics the mapping did not know (used_to, simple_present, conditionals, future_forms,
-- future, paraphrasing, modals, agreement_disagreement, narrative_tenses, ...), so their
-- metrics were stored with skill_category other and micro_skill other, and
-- business/functional_language names had a known micro_skill but category other
-- (extract_skill_category had no business branch).
--
-- SOLUTION (additive, AGENTS.md rule for extract_micro_skill): both functions are
-- re-created with every existing WHEN rule kept byte for byte and in order; new rules sit
-- only in front of the final ELSE other, so a name that already mapped to a real
-- category or micro skill cannot change. extract_micro_skill reuses existing micro values
-- only (no new value, so skill-clusters.csv is unaffected). The three-tier hierarchy
-- skill_category -> micro_skill -> skill_name is preserved and stored skill_name values
-- are not touched.
--
-- Business and professional communication: email -> writing; telephoning, negotiation,
-- diplomatic language, meetings, presentations, generic business and functional_language
-- -> speaking (as the legacy ns.functional.* rule). Agreement, polite requests and
-- suggestions -> speaking category with the functional_language micro skill.
--
-- Existing metric rows are NOT recomputed here. scripts/dslm/recompute-other-category-metrics.sql
-- is the separate, reviewed data script (dry run first).
--
-- Rollback: re-apply the previous definitions (20261012090000 for extract_skill_category,
-- 20261015201345 for extract_micro_skill).

SET LOCAL lock_timeout = '5s';

-- extract_skill_category (v3)
CREATE OR REPLACE FUNCTION public.extract_skill_category(skill_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- ===== NEW CEFR FORMAT: ns.[A1-C2].[topic].* =====
    -- Specific grammar topics (existing)
    WHEN skill_name ~ '^ns\.[ABC][12]\.(past_simple|past_continuous|past_perfect|present_simple|present_continuous|present_perfect|present_perfect_continuous|future_simple|future_going_to|future_continuous|first_conditional|second_conditional|third_conditional|mixed_conditionals|passive_voice|reported_speech|relative_clauses|modal_verbs|gerund_infinitive|phrasal_verbs|comparatives|superlatives|articles|prepositions|word_order|negative_prefixes|word_formation)\.' THEN 'grammar'
    -- Generic grammar catch-all: ns.[CEFR].grammar.* (covers modal_*, going_to_*, will_*, countable_uncountable, to_be_*, etc.)
    WHEN skill_name ~ '^ns\.[ABC][12]\.grammar[\._]' THEN 'grammar'
    -- Related grammar categories
    WHEN skill_name ~ '^ns\.[ABC][12]\.(nouns|pronouns|adjectives|adjectives_adverbs|gerunds|verbs)[\._]' THEN 'grammar'
    -- Vocabulary topics (existing)
    WHEN skill_name ~ '^ns\.[ABC][12]\.(vocabulary|collocations|idioms|synonyms|antonyms)\.' THEN 'vocabulary'
    -- Idiom catch-all (AI sometimes uses ns.B1.idiom.xxx instead of ns.B1.idioms.xxx)
    WHEN skill_name ~ '^ns\.[ABC][12]\.idiom[\._]' THEN 'vocabulary'
    -- Other categories (existing)
    WHEN skill_name ~ '^ns\.[ABC][12]\.reading[\._]' THEN 'reading'
    WHEN skill_name ~ '^ns\.[ABC][12]\.speaking[\._]' THEN 'speaking'
    WHEN skill_name ~ '^ns\.[ABC][12]\.writing[\._]' THEN 'writing'
    WHEN skill_name ~ '^ns\.[ABC][12]\.listening[\._]' THEN 'listening'
    WHEN skill_name ~ '^ns\.[ABC][12]\.visual_comprehension[\._]' THEN 'visual_comprehension'
    WHEN skill_name ~ '^ns\.[ABC][12]\.critical_thinking[\._]' THEN 'reading'
    WHEN skill_name ~ '^ns\.[ABC][12]\.comprehension[\._]' THEN 'reading'
    WHEN skill_name ~ '^ns\.[ABC][12]\.definitions[\._]' THEN 'vocabulary'
    WHEN skill_name ~ '^ns\.[ABC][12]\.spelling[\._]' THEN 'vocabulary'
    WHEN skill_name ~ '^ns\.[ABC][12]\.morphology[\._]' THEN 'grammar'
    WHEN skill_name ~ '^ns\.[ABC][12]\.pronunciation[\._]' THEN 'pronunciation'

    -- ===== OLD ABBREVIATION FORMAT =====
    WHEN skill_name ~ '^ns\.(ps|pc|pp|prs|prc|prp|prpc|fs|fg|fc|cond1|cond2|cond3|condm|passive|rs|rel|mod|ger_inf|phr|comp|sup|art|prep|wo|neg|wf)\.' THEN 'grammar'
    WHEN skill_name ~ '^ns\.(vocab|coll|idiom|syn|ant)\.' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.reading.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.speaking.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.writing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.listening.%' THEN 'listening'

    -- ===== LEGACY FORMAT =====
    WHEN skill_name LIKE 'ns.grammar.%' THEN 'grammar'
    WHEN skill_name LIKE 'ns.vocabulary.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.morphology.%' THEN 'grammar'
    WHEN skill_name LIKE 'ns.pronunciation.%' THEN 'pronunciation'
    WHEN skill_name LIKE 'ns.spelling.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.collocations.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.idiom.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.expression.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.paraphrasing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.sentence.%' THEN 'grammar'
    WHEN skill_name LIKE 'ns.questions.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.comprehension.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.dialogue.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.functional.%' THEN 'speaking'
    WHEN skill_name LIKE 'flashcard:%' THEN 'vocabulary'
    -- ===== v3 (Phase 1 / P1.5): fallbacks only, every rule above is untouched =====
    -- Business and functional language: consistent with extract_micro_skill (was other).
    WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?(email|e_mail)' THEN 'writing'
    WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?(telephon|negotiat|diplomatic|hedging|politeness|meeting|presentation)' THEN 'speaking'
    WHEN skill_name ~ '^ns\.[ABC][12]\.(business|functional_language)' THEN 'speaking'
    -- Prefix-only micro rules without a separator after the topic (parity with extract_micro_skill).
    WHEN skill_name ~ '^ns\.[ABC][12]\.(grammar|nouns|pronouns|adjectives|gerunds|verbs|morphology)' THEN 'grammar'
    WHEN skill_name ~ '^ns\.[ABC][12]\.(definitions|spelling)' THEN 'vocabulary'
    WHEN skill_name ~ '^ns\.[ABC][12]\.(comprehension|critical_thinking)' THEN 'reading'
    WHEN skill_name ~ '^ns\.[ABC][12]\.pronunciation' THEN 'pronunciation'
    -- Real topics the model emits that v1 sent to other.
    WHEN skill_name ~ '^ns\.[ABC][12]\.(used_to|simple_present|simple_past|conditionals?|future(_[a-z_]+)?|modals|narrative_tenses|conjunctions|comparison|comparative_adjective|adverbs(_of_[a-z]+)?|preposition|imperatives?|verb_tense|sentence_structure|past_perfect_(continuous|simple)|present_perfect_simple|noun_clauses|question_formation|verb_patterns?|verb_forms?|infinitive|quantifiers|past_continuous_interrupted_by_simple|past_simple_state|wish(_[a-z_]+)?|gerund_after_phrasal_verb|phrase_verb|phrasal_verb|hypothetical_situations|time_expressions|linking_words|discourse_markers|error_correction)([\._]|$)' THEN 'grammar'
    WHEN skill_name ~ '^ns\.[ABC][12]\.(collocation|idiomatic_expressions?|expressions?|verb_choice|verb_adverb_collocation|matching)([\._]|$)' THEN 'vocabulary'
    WHEN skill_name ~ '^ns\.[ABC][12]\.(agreement(_disagreement)?|disagreement|polite_requests|suggestions|personal_experience|social_interactions|communication)([\._]|$)' THEN 'speaking'
    WHEN skill_name ~ '^ns\.[ABC][12]\.(paraphrasing|academic_writing)([\._]|$)' THEN 'writing'
    WHEN skill_name ~ '^ns\.[ABC][12]\.academic_reading([\._]|$)' THEN 'reading'
    ELSE 'other'
  END;
$function$;

-- extract_micro_skill (v3)
CREATE OR REPLACE FUNCTION public.extract_micro_skill(skill_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN skill_name ~ '^ns\.[ABC][12]\.' THEN
      CASE
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_simple\.' THEN 'past_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_continuous\.' THEN 'past_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_perfect\.' THEN 'past_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_simple\.' THEN 'present_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_continuous\.' THEN 'present_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_perfect_continuous\.' THEN 'present_perfect_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_perfect\.' THEN 'present_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_simple\.' THEN 'future_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_going_to\.' THEN 'future_going_to'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_continuous\.' THEN 'future_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.first_conditional\.' THEN 'first_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.second_conditional\.' THEN 'second_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.third_conditional\.' THEN 'third_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.mixed_conditionals\.' THEN 'mixed_conditionals'
        WHEN skill_name ~ '^ns\.[ABC][12]\.passive_voice\.' THEN 'passive_voice'
        WHEN skill_name ~ '^ns\.[ABC][12]\.reported_speech\.' THEN 'reported_speech'
        WHEN skill_name ~ '^ns\.[ABC][12]\.relative_clauses\.' THEN 'relative_clauses'
        WHEN skill_name ~ '^ns\.[ABC][12]\.modal_verbs\.' THEN 'modal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.gerund_infinitive\.' THEN 'gerund_infinitive'
        WHEN skill_name ~ '^ns\.[ABC][12]\.phrasal_verbs\.' THEN 'phrasal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.comparatives\.' THEN 'comparatives'
        WHEN skill_name ~ '^ns\.[ABC][12]\.superlatives\.' THEN 'superlatives'
        WHEN skill_name ~ '^ns\.[ABC][12]\.articles\.' THEN 'articles'
        WHEN skill_name ~ '^ns\.[ABC][12]\.prepositions\.' THEN 'prepositions'
        WHEN skill_name ~ '^ns\.[ABC][12]\.word_order\.' THEN 'word_order'
        WHEN skill_name ~ '^ns\.[ABC][12]\.negative_prefixes\.' THEN 'negative_prefixes'
        WHEN skill_name ~ '^ns\.[ABC][12]\.word_formation\.' THEN 'word_formation'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.modal' THEN 'modal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.going_to' THEN 'future_going_to'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.will_' THEN 'future_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.present_simple' THEN 'present_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.present_continuous' THEN 'present_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.present_perfect' THEN 'present_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.past_simple' THEN 'past_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.past_continuous' THEN 'past_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.past_perfect' THEN 'past_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.countable_uncountable' THEN 'countable_uncountable'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.negative_prefixes' THEN 'negative_prefixes'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.to_be' THEN 'present_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.conditional' THEN 'first_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.passive' THEN 'passive_voice'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.reported' THEN 'reported_speech'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.relative' THEN 'relative_clauses'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.phrasal' THEN 'phrasal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.word_order' THEN 'word_order'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.word_formation' THEN 'word_formation'
        -- v2 (Pillar 1.1): refinements for names that previously fell back to grammar_other
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.(used_to|would_)' THEN 'used_to_would'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.question_form' THEN 'question_forms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.subject_verb_agreement' THEN 'subject_verb_agreement'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.(verb_pattern|infinitive_after)' THEN 'gerund_infinitive'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.(part_of_speech|identify_)' THEN 'parts_of_speech'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.nouns' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.pronouns' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.adjectives' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.adjectives_adverbs' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.gerunds' THEN 'gerund_infinitive'
        WHEN skill_name ~ '^ns\.[ABC][12]\.verbs' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.vocabulary\.' THEN 'vocabulary'
        WHEN skill_name ~ '^ns\.[ABC][12]\.collocations\.' THEN 'collocations'
        WHEN skill_name ~ '^ns\.[ABC][12]\.idioms?\.' THEN 'idioms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.synonyms\.' THEN 'synonyms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.antonyms\.' THEN 'antonyms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.definitions' THEN 'vocabulary'
        WHEN skill_name ~ '^ns\.[ABC][12]\.spelling' THEN 'vocabulary'
        WHEN skill_name ~ '^ns\.[ABC][12]\.reading\.' THEN 'reading'
        WHEN skill_name ~ '^ns\.[ABC][12]\.speaking\.' THEN 'speaking'
        WHEN skill_name ~ '^ns\.[ABC][12]\.writing\.' THEN 'writing'
        WHEN skill_name ~ '^ns\.[ABC][12]\.listening\.' THEN 'listening'
        WHEN skill_name ~ '^ns\.[ABC][12]\.visual_comprehension\.' THEN 'visual_comprehension'
        WHEN skill_name ~ '^ns\.[ABC][12]\.critical_thinking' THEN 'critical_thinking'
        WHEN skill_name ~ '^ns\.[ABC][12]\.comprehension' THEN 'reading'
        WHEN skill_name ~ '^ns\.[ABC][12]\.morphology' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.pronunciation' THEN 'pronunciation'
        -- v2 (Pillar 1.1): adult professional communication domains (previously other)
        WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?telephon' THEN 'telephoning'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?negotiat' THEN 'negotiation'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?(email|e_mail)' THEN 'email_register'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?(diplomatic|hedging|politeness)' THEN 'diplomatic_language'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?meeting' THEN 'meetings'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(business\.)?presentation' THEN 'presentations'
        WHEN skill_name ~ '^ns\.[ABC][12]\.business' THEN 'business_communication'
        WHEN skill_name ~ '^ns\.[ABC][12]\.functional_language' THEN 'functional_language'
        -- v3 (Phase 1 / P1.5): fallbacks only. Every rule above is untouched; these catch names that v2 sent to other.
        WHEN skill_name ~ '^ns\.[ABC][12]\.used_to([\._]|$)' THEN 'used_to_would'
        WHEN skill_name ~ '^ns\.[ABC][12]\.simple_present([\._]|$)' THEN 'present_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(simple_past|past_simple_state)([\._]|$)' THEN 'past_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_perfect_(continuous|simple)([\._]|$)' THEN 'past_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_perfect_simple([\._]|$)' THEN 'present_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_continuous_interrupted_by_simple([\._]|$)' THEN 'past_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.narrative_tenses[\._].*past_continuous' THEN 'past_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.narrative_tenses[\._].*past_perfect' THEN 'past_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.narrative_tenses[\._].*past_simple' THEN 'past_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.narrative_tenses([\._]|$)' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.conditionals?[\._].*(first|type_?1)' THEN 'first_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.conditionals?[\._].*(second|type_?2)' THEN 'second_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.conditionals?[\._].*(third|type_?3)' THEN 'third_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.conditionals?[\._].*mixed' THEN 'mixed_conditionals'
        WHEN skill_name ~ '^ns\.[ABC][12]\.conditionals?([\._]|$)' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_will([\._]|$)' THEN 'future_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_present_continuous([\._]|$)' THEN 'present_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(future(_[a-z_]+)?|verb_tense)[\._].*(going_to|be_going)' THEN 'future_going_to'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(future(_[a-z_]+)?|verb_tense)[\._].*(will|future_simple)' THEN 'future_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(future(_[a-z_]+)?|verb_tense)([\._]|$)' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.modals([\._]|$)' THEN 'modal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(comparison|comparative_adjective)([\._]|$)' THEN 'comparatives'
        WHEN skill_name ~ '^ns\.[ABC][12]\.preposition([\._]|$)' THEN 'prepositions'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(phrase_verb|phrasal_verb|gerund_after_phrasal_verb)([\._]|$)' THEN 'phrasal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(verb_patterns?|verb_forms?|infinitive)([\._]|$)' THEN 'gerund_infinitive'
        WHEN skill_name ~ '^ns\.[ABC][12]\.question_formation([\._]|$)' THEN 'question_forms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(conjunctions|adverbs(_of_[a-z]+)?|imperatives?|sentence_structure|noun_clauses|quantifiers|wish(_[a-z_]+)?|hypothetical_situations|time_expressions|linking_words|discourse_markers|error_correction)([\._]|$)' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(collocation|verb_adverb_collocation)([\._]|$)' THEN 'collocations'
        WHEN skill_name ~ '^ns\.[ABC][12]\.idiomatic_expressions?([\._]|$)' THEN 'idioms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(expressions?|verb_choice|matching)([\._]|$)' THEN 'vocabulary'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(agreement(_disagreement)?|disagreement|polite_requests|suggestions)([\._]|$)' THEN 'functional_language'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(personal_experience|social_interactions|communication)([\._]|$)' THEN 'speaking'
        WHEN skill_name ~ '^ns\.[ABC][12]\.(paraphrasing|academic_writing)([\._]|$)' THEN 'writing'
        WHEN skill_name ~ '^ns\.[ABC][12]\.academic_reading([\._]|$)' THEN 'reading'
        ELSE 'other'
      END
    WHEN skill_name LIKE 'ns.ps.%' THEN 'past_simple'
    WHEN skill_name LIKE 'ns.pc.%' THEN 'past_continuous'
    WHEN skill_name LIKE 'ns.pp.%' THEN 'past_perfect'
    WHEN skill_name LIKE 'ns.prs.%' THEN 'present_simple'
    WHEN skill_name LIKE 'ns.prc.%' THEN 'present_continuous'
    WHEN skill_name LIKE 'ns.prp.%' THEN 'present_perfect'
    WHEN skill_name LIKE 'ns.prpc.%' THEN 'present_perfect_continuous'
    WHEN skill_name LIKE 'ns.fs.%' THEN 'future_simple'
    WHEN skill_name LIKE 'ns.fg.%' THEN 'future_going_to'
    WHEN skill_name LIKE 'ns.fc.%' THEN 'future_continuous'
    WHEN skill_name LIKE 'ns.cond1.%' THEN 'first_conditional'
    WHEN skill_name LIKE 'ns.cond2.%' THEN 'second_conditional'
    WHEN skill_name LIKE 'ns.cond3.%' THEN 'third_conditional'
    WHEN skill_name LIKE 'ns.condm.%' THEN 'mixed_conditionals'
    WHEN skill_name LIKE 'ns.passive.%' THEN 'passive_voice'
    WHEN skill_name LIKE 'ns.rs.%' THEN 'reported_speech'
    WHEN skill_name LIKE 'ns.rel.%' THEN 'relative_clauses'
    WHEN skill_name LIKE 'ns.mod.%' THEN 'modal_verbs'
    WHEN skill_name LIKE 'ns.ger_inf.%' THEN 'gerund_infinitive'
    WHEN skill_name LIKE 'ns.phr.%' THEN 'phrasal_verbs'
    WHEN skill_name LIKE 'ns.comp.%' THEN 'comparatives'
    WHEN skill_name LIKE 'ns.sup.%' THEN 'superlatives'
    WHEN skill_name LIKE 'ns.art.%' THEN 'articles'
    WHEN skill_name LIKE 'ns.prep.%' THEN 'prepositions'
    WHEN skill_name LIKE 'ns.wo.%' THEN 'word_order'
    WHEN skill_name LIKE 'ns.neg.%' THEN 'negative_prefixes'
    WHEN skill_name LIKE 'ns.wf.%' THEN 'word_formation'
    WHEN skill_name LIKE 'ns.vocab.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.coll.%' THEN 'collocations'
    WHEN skill_name LIKE 'ns.idiom.%' THEN 'idioms'
    WHEN skill_name LIKE 'ns.syn.%' THEN 'synonyms'
    WHEN skill_name LIKE 'ns.ant.%' THEN 'antonyms'
    WHEN skill_name LIKE 'ns.reading.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.speaking.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.writing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.listening.%' THEN 'listening'
    -- v2 (Pillar 1.1): legacy ns.grammar.* names mapped to their real topic (previously grammar_other)
    WHEN skill_name LIKE 'ns.grammar.reported_speech%' THEN 'reported_speech'
    WHEN skill_name LIKE 'ns.grammar.present_perfect_continuous%' THEN 'present_perfect_continuous'
    WHEN skill_name LIKE 'ns.grammar.past_simple_vs_present_perfect%' THEN 'present_perfect'
    WHEN skill_name LIKE 'ns.grammar.present_perfect%' THEN 'present_perfect'
    WHEN skill_name LIKE 'ns.grammar.present_simple%' THEN 'present_simple'
    WHEN skill_name LIKE 'ns.grammar.negative_third_person%' THEN 'present_simple'
    WHEN skill_name LIKE 'ns.grammar.past_simple%' THEN 'past_simple'
    WHEN skill_name LIKE 'ns.grammar.passive%' THEN 'passive_voice'
    WHEN skill_name LIKE 'ns.grammar.third_conditional%' THEN 'third_conditional'
    WHEN skill_name LIKE 'ns.grammar.verb_pattern%' THEN 'gerund_infinitive'
    WHEN skill_name LIKE 'ns.grammar.infinitive_after%' THEN 'gerund_infinitive'
    WHEN skill_name LIKE 'ns.grammar.word_order%' THEN 'word_order'
    WHEN skill_name LIKE 'ns.grammar.part_of_speech%' THEN 'parts_of_speech'
    WHEN skill_name LIKE 'ns.grammar.identify_%' THEN 'parts_of_speech'
    WHEN skill_name LIKE 'ns.grammar.%' THEN 'grammar_other'
    WHEN skill_name LIKE 'ns.vocabulary.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.morphology.%' THEN 'grammar_other'
    WHEN skill_name LIKE 'ns.pronunciation.%' THEN 'pronunciation'
    WHEN skill_name LIKE 'ns.spelling.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.collocations.%' THEN 'collocations'
    WHEN skill_name LIKE 'ns.idiom.%' THEN 'idioms'
    WHEN skill_name LIKE 'ns.expression.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.paraphrasing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.sentence.%' THEN 'grammar_other'
    WHEN skill_name LIKE 'ns.questions.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.comprehension.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.dialogue.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.functional.%' THEN 'speaking'
    WHEN skill_name LIKE 'flashcard:%' THEN 'flashcard'
    ELSE 'other'
  END;
$function$;
