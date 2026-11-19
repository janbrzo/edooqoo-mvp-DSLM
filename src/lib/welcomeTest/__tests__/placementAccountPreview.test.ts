import { describe, expect, it } from 'vitest';
import { buildPlacementAccountPreview, readPlacementSelfAssessedLevel } from '../placementAccountPreview';
import type { PublicPlacementResult } from '../publicPlacementTest';

const result = {
  level: 'A2', skills: {
    grammar: { score: 27, correct: 3, answered: 11 }, vocabulary: { score: 9, correct: 1, answered: 11 },
    reading: { score: 25, correct: 1, answered: 4 }, listening: { score: 67, correct: 2, answered: 3 },
  },
} as unknown as PublicPlacementResult;

describe('buildPlacementAccountPreview', () => {
  it('previews the same two goals the claim creates: weakest then strongest', () => {
    expect(buildPlacementAccountPreview(result).goals).toEqual(['Improve vocabulary range', 'Build confidence from listening comprehension']);
  });

  it('suggests the first lesson for the weakest skill', () => {
    expect(buildPlacementAccountPreview(result).firstLesson).toContain('vocabulary');
  });

  it('provides a complete illustrative AI analysis with three observations and recommendations', () => {
    const { aiSummary } = buildPlacementAccountPreview(result);
    expect(aiSummary.summary).toContain('work-focused learning plan');
    expect(aiSummary.keyObservations).toHaveLength(3);
    expect(aiSummary.recommendations).toHaveLength(3);
    expect(aiSummary.writingQuality).toBe('intermediate');
  });

  it('provides all six sample profile groups with readable evidence and confidence', () => {
    const { traitsData } = buildPlacementAccountPreview(result);
    expect(traitsData.map((group) => group.title)).toEqual([
      'Motivation', 'Learning style', 'Feedback', 'Feelings about English', 'Self-awareness', 'Intensity',
    ]);
    expect(traitsData.flatMap((group) => group.traits)).toHaveLength(21);
    expect(traitsData[0].traits[0]).toMatchObject({
      key: 'self_assessed_level',
      label: 'Self-assessed level',
      value: 'A2-B1',
      basedOn: 'How they describe their own English',
      confidence: { chip: 'Low confidence (1 answer)' },
    });
    expect(traitsData[5].traits[0]).toMatchObject({
      label: 'Learning Path Intensity',
      value: 'Accelerated (75/100)',
      confidence: { chip: 'Medium confidence (several answers)' },
    });
  });

  it('uses three real bank questions with explicit sample answers and empty teacher notes', () => {
    const { sampleQuestions } = buildPlacementAccountPreview(result);
    expect(sampleQuestions.map((question) => question.id)).toEqual(['wt_q22', 'wt_q12', 'wt_q13c']);
    expect(sampleQuestions.map((question) => question.questionType)).toEqual([
      'multiple_choice', 'open_reflection', 'scenario_reaction',
    ]);
    expect(sampleQuestions[0]).toMatchObject({
      questionText: 'If I ___ earlier, I wouldn\'t have missed the train.',
      studentAnswer: 'had left',
      correctAnswer: 'had left',
      isCorrect: true,
      teacherNote: '',
      teacherNotePlaceholder: 'Add a note about this answer...',
    });
    expect(sampleQuestions[1].studentAnswer).toContain('explain a decision to a client');
    expect(sampleQuestions[2].studentAnswer).toBe('Change the method, teacher, or approach');
    expect(sampleQuestions.every((question) => question.teacherNote === '')).toBe(true);
  });

  it('keeps illustrative sections independent of the current student result', () => {
    const first = buildPlacementAccountPreview(result);
    const differentResult: PublicPlacementResult = {
      ...result,
      level: 'C1',
      skills: { grammar: { score: 100, correct: 9, answered: 9, total: 9 } },
    };
    const second = buildPlacementAccountPreview(differentResult);
    expect(second.aiSummary).toEqual(first.aiSummary);
    expect(second.traitsData).toEqual(first.traitsData);
    expect(second.sampleQuestions).toEqual(first.sampleQuestions);
    expect(second.goals).not.toEqual(first.goals);
  });

  it('reads the self-assessed level from legacy traits when the newer field is absent', () => {
    const legacyResult = {
      ...result,
      selfAssessedLevel: undefined,
      traits: { self_assessed_level: 'A1-A2' },
    } as PublicPlacementResult;
    expect(readPlacementSelfAssessedLevel(legacyResult)).toBe('A1-A2');
    expect(readPlacementSelfAssessedLevel({ ...legacyResult, selfAssessedLevel: 'B1-B2' })).toBe('B1-B2');
  });
});
