#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GENERATOR_PREVIEW_EXERCISES,
  GENERATOR_PREVIEW_SCENARIOS,
  renderExercisePreview,
  renderWorksheetGeneratorPreview,
} from './worksheet-generator-preview.mjs';

const taxonomySource = readFileSync(new URL('../../src/lib/exerciseTaxonomy.ts', import.meta.url), 'utf8');
const taxonomyIds = ['NO_MEDIA_EXERCISE_IDS', 'PICTURE_EXERCISE_IDS', 'AUDIO_EXERCISE_IDS']
  .flatMap((name) => {
    const match = taxonomySource.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`));
    assert.ok(match, `Missing taxonomy array: ${name}`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
  });

assert.equal(GENERATOR_PREVIEW_EXERCISES.length, 28);
assert.equal(new Set(GENERATOR_PREVIEW_EXERCISES.map((exercise) => exercise.id)).size, 28);
assert.deepEqual(
  GENERATOR_PREVIEW_EXERCISES.map((exercise) => exercise.id).sort(),
  taxonomyIds.sort(),
  'The public preview must match every active exercise ID and exclude disabled formats.',
);
assert.equal(GENERATOR_PREVIEW_EXERCISES.some((exercise) => exercise.id === 'sentence-transformation'), false);
assert.deepEqual(GENERATOR_PREVIEW_SCENARIOS.map((scenario) => scenario.level), ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
assert.equal(new Set(GENERATOR_PREVIEW_SCENARIOS.map((scenario) => scenario.id)).size, 6);

const publicCountSources = [
  'src/constants/clusterHubs.ts',
  'src/constants/faqItems.ts',
  'src/constants/seoMeta.ts',
  'src/components/seo/SeoLandingLayout.tsx',
  'src/pages/About.tsx',
  'src/pages/ExerciseTypes.tsx',
  'src/pages/Glossary.tsx',
  'src/pages/HowItWorks.tsx',
  'src/pages/Resources.tsx',
  'src/pages/features/FeatureHomework.tsx',
  'src/pages/seo/EnglishGamesForLearners.tsx',
  'src/pages/seo/EslClassToolkit.tsx',
  'src/pages/seo/EslGamesForTeachers.tsx',
  'src/pages/seo/EslWorksheets.tsx',
  'src/pages/seo/ForEnglishTutors.tsx',
  'src/pages/seo/programmatic/ExerciseTopicPage.tsx',
  'scripts/seo/generate-citable-pages.mjs',
];
for (const file of publicCountSources) {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  assert.equal(/\b29\s+(?:[A-Za-z]+\s+){0,2}exercise types\b/.test(source), false, `${file}: outdated 29-type claim`);
  assert.equal(/\b29\s+(?:types|typed exercise formats)\b/.test(source), false, `${file}: outdated 29-type shorthand`);
  assert.equal(/20 basic|Basic Exercises \(20/.test(source), false, `${file}: outdated basic-type count`);
}
for (const file of ['src/pages/ExerciseTypes.tsx', 'src/pages/Glossary.tsx']) {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  assert.equal(source.includes('Sentence Transformation'), false, `${file}: disabled format presented publicly`);
}

for (const scenario of GENERATOR_PREVIEW_SCENARIOS) {
  for (const exercise of GENERATOR_PREVIEW_EXERCISES) {
    const preview = renderExercisePreview(exercise, scenario);
    const combined = `${preview.instructions} ${preview.content} ${preview.answers}`;
    assert.ok(preview.instructions.length > 20, `${scenario.id}/${exercise.id}: missing instructions`);
    assert.ok(preview.answers.length > 0, `${scenario.id}/${exercise.id}: missing answer guidance`);
    assert.ok(/<input|<textarea|<select|data-eq-preview-audio/.test(preview.content), `${scenario.id}/${exercise.id}: not interactive`);
    assert.equal(combined.includes('undefined'), false, `${scenario.id}/${exercise.id}: undefined content`);
    assert.equal(combined.includes('This cached preview is unavailable.'), false, `${scenario.id}/${exercise.id}: missing renderer`);
    assert.equal(combined.includes('\u2014'), false, `${scenario.id}/${exercise.id}: em dash`);
  }
}

const html = renderWorksheetGeneratorPreview();
assert.ok(html.includes('Try 28 exercise formats'));
assert.ok(html.includes('no AI call and no token use'));
assert.ok(html.includes('Answers stay in this page'));
assert.ok(html.includes('/signup?src=pseo-ai-worksheet-generator-preview'));
assert.ok(html.includes('id="eq-generator-form"'));
assert.ok(html.includes('data-eq-preview-audio'));
assert.equal(html.includes('\u2014'), false);
assert.equal(html.includes('undefined'), false, 'Generated public HTML must not contain the audit-blocked undefined literal');
assert.equal(/fetch\s*\(|XMLHttpRequest|generateWorksheet|consumeToken/.test(html), false);

console.log('[generator-preview-test] PASS 28 active types, 6 CEFR contexts, 168 cached combinations, interaction and zero-generation guards.');
