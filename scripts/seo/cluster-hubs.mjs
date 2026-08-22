/**
 * Sprint 3 (Faza 3) — cluster hub registry.
 *
 * PROBLEM: 441 URLs rank, ~40 earn a click. Every article fights alone at position 12-18
 * because there is no topical hub consolidating internal link equity, and LLMs have no
 * single extractable definition per topic.
 *
 * SOLUTION: four hub-and-spoke clusters built only on demand already measured in GSC.
 * This file is the single source of truth for hub routes, their funnel tool, and the
 * spoke pages that must carry a backlink to the hub.
 *
 * Consumers: scripts/seo/inject-cluster-hub-links.mjs (writes backlinks into public HTML),
 * scripts/seo/audit-cluster-hubs.mjs (CI guard), src/constants/clusterHubs.ts (React mirror).
 */

export const CLUSTER_HUB_BACKLINK_MARKER = 'data-cluster-hub';

export const CLUSTER_HUBS = [
  {
    id: 'cefr-assessment',
    route: '/cefr-assessment',
    anchor: 'CEFR assessment hub',
    tool: '/tools/vocab-cefr-checker',
    title: 'CEFR Assessment for Adult 1:1 English Tutors',
    description:
      'Place an adult student on the CEFR scale in one lesson: free level test, vocabulary checker, and what to do with the result.',
    htmlSpokes: [
      'blog/diagnostic-testing-english-learners.html',
      'blog/what-should-adult-english-placement-test-include.html',
      'blog/formative-assessment-english-teaching.html',
      'blog/cefr-aligned-worksheet-generation-workflow.html',
    ],
    routeSpokes: ['/features/placement-test', '/tools/cefr-level-test', '/tools/vocab-cefr-checker'],
  },
  {
    id: 'pronunciation',
    route: '/teaching-english-pronunciation',
    anchor: 'pronunciation teaching hub',
    tool: '/esl-worksheets',
    title: 'Teaching English Pronunciation to Adults — Tutor Hub',
    description:
      'Stress, intonation, minimal pairs and connected speech for adult 1:1 lessons, with drills you can turn into a worksheet in a minute.',
    htmlSpokes: [
      'blog/teaching-english-intonation-stress.html',
      'blog/teaching-minimal-pairs-esl.html',
      'blog/accent-reduction-activities-esl.html',
      'blog/teaching-collocations-esl.html',
      'blog/connected-speech-teaching-activities.html',
      'blog/how-to-teach-english-pronunciation.html',
    ],
    routeSpokes: ['/exercise-types', '/esl-worksheets'],
  },
  {
    id: 'exercise-design',
    route: '/esl-exercise-design',
    anchor: 'ESL exercise design hub',
    tool: '/exercise-types',
    title: 'ESL Exercise Design — Cloze, Gap-Fill, Transformation',
    description:
      'How to design cloze, gap-fill, word formation and transformation tasks that diagnose an adult learner instead of filling lesson time.',
    htmlSpokes: [
      'blog/fill-in-the-blanks-exercises-best-practices.html',
      'blog/cloze-test-design-esl.html',
      'blog/word-formation-exercises-english.html',
      'modal-verbs-worksheets-esl.html',
      'blog/esl-exercise-type-selection-guide.html',
      'blog/task-based-language-teaching-worksheets.html',
    ],
    routeSpokes: ['/exercise-types', '/esl-worksheets'],
  },
  {
    id: 'tutor-operations',
    route: '/tutor-operations',
    anchor: 'tutor operations hub',
    tool: '/tools/what-should-i-teach-next',
    title: 'Tutor Operations — Homework, Reports, Lesson Records',
    description:
      'Run a 1:1 English tutoring practice: homework review, progress reports, what-to-teach-next decisions and lesson records in one workflow.',
    htmlSpokes: [
      'blog/digital-homework-tools-esl-teachers.html',
      'blog/writing-student-progress-reports-esl.html',
      'blog/english-homework-ai-grading-workflow.html',
      'blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html',
    ],
    routeSpokes: ['/features/homework', '/features/calendar', '/what-to-teach-next'],
  },
];

export const CLUSTER_HUB_ROUTES = CLUSTER_HUBS.map((hub) => hub.route);

export function hubByRoute(route) {
  return CLUSTER_HUBS.find((hub) => hub.route === route);
}

export function backlinkHtml(hub) {
  return `<p ${CLUSTER_HUB_BACKLINK_MARKER}="${hub.id}">Part of the Edooqoo <a href="${hub.route}">${hub.anchor}</a>.</p>`;
}
