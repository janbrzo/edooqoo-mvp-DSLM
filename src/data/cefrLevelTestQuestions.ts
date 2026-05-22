// CEFR Level Test — 25 questions distributed across A1→C2.
// Pure client-side scoring; no PII, no network.
export type CefrTestLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface CefrTestQuestion {
  id: number;
  level: CefrTestLevel;
  prompt: string;
  options: string[];
  answerIndex: number;
}

export const CEFR_TEST_QUESTIONS: CefrTestQuestion[] = [
  // A1 (4)
  { id: 1, level: 'A1', prompt: 'My name ___ Anna.', options: ['am', 'is', 'are', 'be'], answerIndex: 1 },
  { id: 2, level: 'A1', prompt: 'I ___ a teacher.', options: ['am', 'is', 'are', 'be'], answerIndex: 0 },
  { id: 3, level: 'A1', prompt: 'There ___ two books on the table.', options: ['is', 'are', 'be', 'am'], answerIndex: 1 },
  { id: 4, level: 'A1', prompt: 'She ___ coffee every morning.', options: ['drink', 'drinks', 'drinking', 'drank'], answerIndex: 1 },
  // A2 (4)
  { id: 5, level: 'A2', prompt: 'Yesterday I ___ to the cinema.', options: ['go', 'went', 'gone', 'goes'], answerIndex: 1 },
  { id: 6, level: 'A2', prompt: 'He is ___ than his brother.', options: ['tall', 'taller', 'tallest', 'more tall'], answerIndex: 1 },
  { id: 7, level: 'A2', prompt: 'We ___ visit our grandparents next weekend.', options: ['are going to', 'go', 'went', 'going'], answerIndex: 0 },
  { id: 8, level: 'A2', prompt: 'There isn’t ___ milk in the fridge.', options: ['some', 'any', 'a', 'many'], answerIndex: 1 },
  // B1 (5)
  { id: 9, level: 'B1', prompt: 'I’ve lived here ___ 2018.', options: ['for', 'since', 'from', 'ago'], answerIndex: 1 },
  { id: 10, level: 'B1', prompt: 'If it rains tomorrow, we ___ at home.', options: ['stayed', 'stay', 'will stay', 'would stay'], answerIndex: 2 },
  { id: 11, level: 'B1', prompt: 'She told me that she ___ tired.', options: ['is', 'was', 'has been', 'be'], answerIndex: 1 },
  { id: 12, level: 'B1', prompt: 'You ___ smoke in the office. It’s forbidden.', options: ['mustn’t', 'don’t have to', 'shouldn’t', 'needn’t'], answerIndex: 0 },
  { id: 13, level: 'B1', prompt: 'The report ___ by the manager yesterday.', options: ['wrote', 'was written', 'has written', 'is writing'], answerIndex: 1 },
  // B2 (5)
  { id: 14, level: 'B2', prompt: 'I wish I ___ more time to finish the project.', options: ['have', 'had', 'will have', 'would have'], answerIndex: 1 },
  { id: 15, level: 'B2', prompt: 'By the time we arrived, the meeting ___ already started.', options: ['has', 'had', 'was', 'did'], answerIndex: 1 },
  { id: 16, level: 'B2', prompt: 'It’s the most fascinating book ___ I’ve ever read.', options: ['what', 'who', 'that', 'whose'], answerIndex: 2 },
  { id: 17, level: 'B2', prompt: 'She suggested ___ a new approach.', options: ['to try', 'trying', 'try', 'tried'], answerIndex: 1 },
  { id: 18, level: 'B2', prompt: 'Not only ___ the deadline, but they also exceeded targets.', options: ['they met', 'did they meet', 'they did meet', 'met they'], answerIndex: 1 },
  // C1 (4)
  { id: 19, level: 'C1', prompt: 'Had I known about the issue, I ___ acted sooner.', options: ['would', 'will have', 'would have', 'had'], answerIndex: 2 },
  { id: 20, level: 'C1', prompt: 'The proposal was met with widespread ___ from stakeholders.', options: ['skepticism', 'skeptic', 'skeptical', 'skeptically'], answerIndex: 0 },
  { id: 21, level: 'C1', prompt: 'She is ___ to taking responsibility for her team.', options: ['accustomed', 'used', 'familiar', 'aware'], answerIndex: 0 },
  { id: 22, level: 'C1', prompt: 'The findings ___ further investigation.', options: ['warrant', 'guarantee', 'ensure', 'insist'], answerIndex: 0 },
  // C2 (3)
  { id: 23, level: 'C2', prompt: '___ his shortcomings, he remains a respected figure.', options: ['Despite of', 'Notwithstanding', 'Although', 'Even'], answerIndex: 1 },
  { id: 24, level: 'C2', prompt: 'The argument is ___ at best and disingenuous at worst.', options: ['tenuous', 'tenacious', 'tedious', 'tenable'], answerIndex: 0 },
  { id: 25, level: 'C2', prompt: 'She has a ___ grasp of the regulatory landscape.', options: ['nuanced', 'numb', 'nominal', 'notional'], answerIndex: 0 },
];

export function scoreCefr(answers: Record<number, number>): { level: CefrTestLevel; score: number; total: number } {
  let score = 0;
  for (const q of CEFR_TEST_QUESTIONS) {
    if (answers[q.id] === q.answerIndex) score += 1;
  }
  const pct = score / CEFR_TEST_QUESTIONS.length;
  // Threshold map calibrated to 25 questions distributed 4/4/5/5/4/3
  let level: CefrTestLevel = 'A1';
  if (pct >= 0.92) level = 'C2';
  else if (pct >= 0.8) level = 'C1';
  else if (pct >= 0.66) level = 'B2';
  else if (pct >= 0.5) level = 'B1';
  else if (pct >= 0.32) level = 'A2';
  return { level, score, total: CEFR_TEST_QUESTIONS.length };
}