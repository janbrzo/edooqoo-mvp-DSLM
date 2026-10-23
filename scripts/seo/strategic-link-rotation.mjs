/** Additional, topic-matched recommendations for the Step 4.1 destinations.
 * Counts describe distinct new source pages, not repeated anchors on one page.
 * Eligibility always comes from the content registry, never from this list.
 */
export const STRATEGIC_LINK_DESTINATIONS = [
  ['/blog/ielts-preparation-worksheets-guide.html', 'IELTS worksheet preparation', 'assessment', 5],
  ['/blog/task-based-language-teaching-worksheets.html', 'Task-based English worksheets', 'planning', 4],
  ['/a1-beginner-english-worksheets.html', 'A1 beginner English worksheets', 'assessment', 2],
  ['/a2-elementary-english-worksheets.html', 'A2 elementary English worksheets', 'assessment', 2],
  ['/ai-lesson-planning-for-english-teachers.html', 'AI lesson planning for English teachers', 'planning', 5],
  ['/articles-a-an-the-worksheets.html', 'Articles a/an/the worksheets', 'language', 1],
  ['/best-ai-tools-for-esl-teachers.html', 'AI tools for English tutors', 'operations', 2],
  ['/blog/best-lesson-prep-tool-for-english-tutors.html', 'Choosing a lesson prep tool', 'operations', 3],
  ['/blog/english-games-for-learners', 'English games for adult learners', 'planning', 3],
  ['/blog/esl-exercise-type-selection-guide.html', 'Choosing an ESL exercise type', 'planning', 2],
  ['/blog/esl-games-for-teachers', 'ESL games for adult English lessons', 'planning', 5],
  ['/blog/intrinsic-motivation-language-learning.html', 'Motivation in language learning', 'evidence', 1],
  ['/blog/item-analysis-english-tests.html', 'English test item analysis', 'assessment', 2],
  ['/blog/journal-writing-esl-students.html', 'Journal writing for English learners', 'language', 2],
  ['/blog/krashen-hypotheses-esl-teaching.html', 'Krashen hypotheses in English teaching', 'language', 2],
  ['/blog/learning-pacing-scientific-vs-pragmatic-esl.html', 'Learning pacing for English tutors', 'evidence', 3],
  ['/blog/lesson-sequencing-scaffolding-curriculum.html', 'Lesson sequencing and scaffolding', 'planning', 1],
  ['/blog/lexical-approach-language-teaching.html', 'The lexical approach to language teaching', 'language', 2],
  ['/blog/motivating-reluctant-esl-learners.html', 'Supporting reluctant English learners', 'evidence', 2],
  ['/blog/portfolio-assessment-esl-writing.html', 'Writing portfolio assessment', 'assessment', 1],
  ['/blog/self-assessment-strategies-esl.html', 'English learner self-assessment', 'assessment', 3],
  ['/blog/self-directed-learning-esl.html', 'Self-directed English learning', 'evidence', 2],
  ['/blog/setting-up-freelance-esl-business.html', 'Setting up a freelance tutoring practice', 'operations', 1],
  ['/blog/syllabus-design-esl-courses.html', 'Designing an English learning syllabus', 'planning', 2],
  ['/blog/teach-english-online-guide', 'Teaching English online', 'operations', 4],
  ['/blog/teaching-aviation-english.html', 'Teaching aviation English', 'language', 2],
  ['/blog/teaching-ellipsis-substitution-english.html', 'Teaching ellipsis and substitution', 'language', 1],
  ['/blog/teaching-english-hospitality-tourism.html', 'English for hospitality and tourism', 'language', 1],
  ['/blog/teaching-english-immigrants-refugees.html', 'English for everyday adult communication', 'language', 3],
  ['/blog/teaching-english-through-literature.html', 'Teaching English through literature', 'language', 2],
  ['/blog/teaching-essay-structure-esl.html', 'Teaching English essay structure', 'language', 2],
  ['/blog/teaching-idioms-esl-activities.html', 'Teaching English idioms', 'language', 2],
  ['/blog/role-play-activities-esl.html', 'Role-play for adult English lessons', 'language', 3],
  ['/blog/teaching-english-online-complete-guide.html', 'Teaching English online: complete guide', 'operations', 2],
  ['/blog/teaching-legal-english.html', 'Teaching legal English', 'language', 2],
  ['/blog/teaching-linking-words-connectors.html', 'Teaching linking words and connectors', 'language', 2],
  ['/blog/teaching-pragmatics-esl.html', 'Teaching pragmatics to adult learners', 'language', 2],
];

const TOPIC_PATTERNS = {
  assessment: /assessment|cefr|placement|diagnostic|test|exam|worksheet|exercise/,
  planning: /lesson|prep|worksheet|exercise|curriculum|teach|learning/,
  language: /grammar|vocab|reading|writing|speaking|listening|english|worksheet|exercise/,
  evidence: /progress|pacing|feedback|homework|learning|student|lesson|teach/,
  operations: /tool|workflow|tutor|planning|prep|organizat|homework|ai-|chatgpt/,
};

/** Pure deterministic allocation: three extra links per indexable donor at most.
 * Augmenting paths avoid greedy starvation of destinations with few donors.
 * Existing recommendations remain intact; no new link duplicates an old one.
 */
export function allocateStrategicLinks(sources, eligibleRoutes, destinations = STRATEGIC_LINK_DESTINATIONS) {
  const donors = [...sources].filter((source) => eligibleRoutes.has(source.route))
    .sort((a, b) => a.route.localeCompare(b.route));
  const tasks = destinations.filter(([route]) => eligibleRoutes.has(route)).flatMap(
    ([route, label, topic, count]) => Array.from({ length: count }, () => ({ route, label, topic })),
  );
  const assigned = donors.map(() => []);
  const candidates = tasks.map((task) => donors.map((source, index) => ({ source, index }))
    .filter(({ source }) => source.route !== task.route
      && !source.existingLinks.some(([route]) => route === task.route)
      && TOPIC_PATTERNS[task.topic]?.test(source.route))
    .map(({ index }) => index));

  function place(taskIndex, visited) {
    const task = tasks[taskIndex];
    const ranked = [...candidates[taskIndex]].sort((a, b) => assigned[a].length - assigned[b].length || a - b);
    for (const donorIndex of ranked) {
      if (visited.has(donorIndex)) continue;
      if (assigned[donorIndex].some((other) => tasks[other].route === task.route)) continue;
      visited.add(donorIndex);
      if (assigned[donorIndex].length < 3) {
        assigned[donorIndex].push(taskIndex);
        return true;
      }
      for (const displaced of [...assigned[donorIndex]]) {
        if (place(displaced, visited)) {
          assigned[donorIndex] = assigned[donorIndex].filter((other) => other !== displaced);
          assigned[donorIndex].push(taskIndex);
          return true;
        }
      }
    }
    return false;
  }

  const orderedTasks = tasks.map((_, index) => index)
    .sort((a, b) => candidates[a].length - candidates[b].length || a - b);
  for (const taskIndex of orderedTasks) {
    if (!place(taskIndex, new Set())) {
      throw new Error(`Insufficient topic-matched link capacity for ${tasks[taskIndex].route}`);
    }
  }
  return new Map(donors.map((source, index) => [source.route,
    assigned[index].map((taskIndex) => [tasks[taskIndex].route, tasks[taskIndex].label]),
  ]));
}