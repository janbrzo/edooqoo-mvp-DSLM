import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlacementReportPage from '@/pages/PlacementReportPage';
import type { PlacementReport } from '@/lib/welcomeTest/placementReportApi';

const mocks = vi.hoisted(() => ({
  getPlacementReport: vi.fn(),
  generatePlacementNextSteps: vi.fn(),
  generatePlacementLearningPath: vi.fn(),
  prefillPlacementLesson: vi.fn(),
  rememberPlacementLesson: vi.fn(),
  pendingPlacementLessonId: vi.fn(),
  registered: false,
  claimPlacementReport: vi.fn(),
  forwardPlacementReport: vi.fn(),
  rememberPendingClaim: vi.fn(),
  takePendingClaim: vi.fn(),
  clearPostSignupAddStudentIntent: vi.fn(),
  navigate: vi.fn(),
  invalidateQueries: vi.fn(),
  token: 'teacher_abcdefghijklmnopqrstuvwx',
}));

vi.mock('@/lib/welcomeTest/placementReportApi', () => ({
  PLACEMENT_REPORT_TOKEN_PATTERN: /^[A-Za-z0-9_-]{20,64}$/,
  getPlacementReport: mocks.getPlacementReport,
  generatePlacementNextSteps: mocks.generatePlacementNextSteps,
  generatePlacementLearningPath: mocks.generatePlacementLearningPath,
  claimPlacementReport: mocks.claimPlacementReport,
  forwardPlacementReport: mocks.forwardPlacementReport,
  rememberPendingClaim: mocks.rememberPendingClaim,
  takePendingClaim: mocks.takePendingClaim,
  clearPostSignupAddStudentIntent: mocks.clearPostSignupAddStudentIntent,
}));
vi.mock('@/lib/welcomeTest/placementLessonPrefill', () => ({
  prefillPlacementLesson: mocks.prefillPlacementLesson,
  rememberPlacementLesson: mocks.rememberPlacementLesson,
  pendingPlacementLessonId: mocks.pendingPlacementLessonId,
  clearPendingPlacementLesson: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ token: mocks.token }),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }) }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useAuthFlow', () => ({ useAuthFlow: () => ({ loading: false, isRegisteredUser: mocks.registered }) }));
vi.mock('@/contexts/DemoContext', () => ({ useDemoContext: () => ({ isDemoMode: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseResult: PlacementReport['result'] = {
  version: 1,
  completedAt: '2026-11-24T08:00:00.000Z',
  expiresAt: '2026-12-01T08:00:00.000Z',
  answeredCount: 50,
  totalQuestions: 72,
  level: 'B1',
  levelConfidence: 'accurate',
  skills: {
    grammar: { score: 65, correct: 13, answered: 20, total: 20 },
    vocabulary: { score: 80, correct: 8, answered: 10, total: 10 },
  },
  traits: { motivation_type: 'career_growth' },
  divergences: [],
  selfAwarenessScore: 75,
  openResponseCount: 2,
  recordingCount: 0,
};

const fullDiagnostic: NonNullable<PlacementReport['teacherDiagnostic']> = {
  studentId: 'student-1',
  testId: 'test-1',
  test: {
    id: 'test-1',
    status: 'reviewed',
    score_percentage: 70,
    answered_count: 50,
    total_questions: 72,
    completed_at: '2026-11-24T08:00:00.000Z',
    reviewed_at: '2026-11-24T08:01:00.000Z',
    time_spent_seconds: 900,
  },
  learningProfile: {
    estimated_level: 'B1',
    self_assessed_level: 'B1',
    level_confidence: 'accurate',
    grammar_score: 65,
    vocabulary_score: 80,
    writing_score: 72,
    motivation_type: 'career_growth',
    interest_topics: ['Product management', 'Negotiations'],
    confidence_speaking: 3,
    confidence_writing: 4,
    ai_summary: JSON.stringify({
      summary: 'Strong vocabulary for workplace topics, with recurring past tense gaps.',
      key_observations: ['Consistent lexical range in B1 scenarios'],
      recommendations: ['Focus Lesson 1 on Past Simple vs Present Perfect in status updates'],
      writing_quality: 'intermediate',
    }),
  },
  skillResults: [
    { element_type: 'grammar', correct_answers: 13, total_questions: 20, score_percentage: 65 },
    { element_type: 'vocabulary', correct_answers: 8, total_questions: 10, score_percentage: 80 },
  ],
  questions: [
    {
      id: 'q-1',
      question_index: 1,
      question_type: 'multiple_choice',
      question_text: 'Choose the correct form: We ___ the report yesterday.',
      question_data: null,
      correct_answer: 'sent',
      explanation: 'Past Simple is used with finished time expressions like yesterday.',
      element_type: 'grammar',
      difficulty_level: 'B1',
      skill_tags: ['past_simple'],
      student_answer: 'have sent',
      is_correct: false,
      answered_at: '2026-11-24T07:50:00.000Z',
      ai_feedback: null,
    },
  ],
  goals: [{ id: 'g-1', title: 'Past tense accuracy in status updates', description: 'Eliminate Present Perfect / Past Simple confusion.' }],
  nextSteps: [],
  curriculumPhases: [],
};

let renderer: ReactTestRenderer | undefined;
function textOf(node: ReactTestRenderer | undefined): string {
  return JSON.stringify(node?.toJSON() ?? '');
}

beforeEach(() => { vi.clearAllMocks(); mocks.registered = false; });
afterEach(async () => { await act(async () => renderer?.unmount()); renderer = undefined; });

describe('PlacementReportPage real teacher diagnostic view', () => {
  const lessons = [1, 2, 3].map(n => ({ id: `lesson-${n}`, topic: `Workplace lesson ${n}`, goal: 'Address a test gap', grammarFocus: null, additionalInfo: null, rationale: 'Measured gap', difficulty: 'B1' as const, exercises: [], exerciseFocusMap: {} }));
  const phases = [1, 2, 3].map((n, i) => ({ id: `phase-${n}`, sequenceNumber: n, title: `Career phase ${n}`, description: `Practice task ${n}`, focusAreas: ['past simple', 'status updates'], estimatedWeeksStart: i * 3 + 1, estimatedWeeksEnd: (i + 1) * 3, rationale: 'Addresses measured placement gap.' }));
  const report: PlacementReport = { role: 'teacher', studentName: 'Anna', result: baseResult, expiresAt: baseResult.expiresAt, claimed: false, teacherDiagnostic: fullDiagnostic, nextSteps: { status: 'idle' }, learningPath: { status: 'idle' } };
  it('generates a learning path with one teacher-token request and renders phases with account CTA', async () => {
    mocks.getPlacementReport.mockResolvedValue(report);
    mocks.generatePlacementLearningPath.mockResolvedValue({ status: 'ready', phases });
    await act(async () => { renderer = create(<PlacementReportPage />); });
    const generate = renderer?.root.findAllByType('button').find(b => b.children.some(c => typeof c === 'string' && c.includes('Generate learning path')));
    if (!generate) throw new Error('Generate learning path action missing');
    await act(async () => { await generate.props.onClick(); });
    expect(mocks.generatePlacementLearningPath).toHaveBeenCalledTimes(1);
    expect(mocks.generatePlacementLearningPath).toHaveBeenCalledWith(mocks.token);
    const rendered = textOf(renderer);
    expect(rendered).toContain('Career phase 1');
    expect(rendered).toContain('Weeks ');
    expect(rendered).toContain('Create free account to save and edit learning path');
  });
  it('blocks learning path generation while the placement diagnostic is not ready', async () => {
    mocks.getPlacementReport.mockResolvedValue({ ...report, teacherDiagnostic: undefined });
    await act(async () => { renderer = create(<PlacementReportPage />); });
    const generate = renderer?.root.findAllByType('button').find(b => b.children.some(c => typeof c === 'string' && c.includes('Generate learning path')));
    expect(generate?.props.disabled).toBe(true);
    expect(mocks.generatePlacementLearningPath).not.toHaveBeenCalled();
  });
  it('runs one teacher-token request and hands the selected one of three lessons to the manual form', async () => {
    mocks.getPlacementReport.mockResolvedValue(report);
    mocks.generatePlacementNextSteps.mockResolvedValue({ status: 'ready', suggestions: lessons });
    await act(async () => { renderer = create(<PlacementReportPage />); });
    const generate = renderer?.root.findAllByType('button').find(b => b.children.some(c => typeof c === 'string' && c.includes('Generate 3')));
    if (!generate) throw new Error('Generate action missing');
    await act(async () => { await generate.props.onClick(); });
    expect(mocks.generatePlacementNextSteps).toHaveBeenCalledTimes(1);
    expect(mocks.generatePlacementNextSteps).toHaveBeenCalledWith(mocks.token);
    const prepare = renderer?.root.findAllByType('button').filter(b => b.children.some(c => typeof c === 'string' && c.includes('Prepare worksheet')));
    expect(prepare).toHaveLength(3);
    await act(async () => { prepare?.[1].props.onClick(); });
    expect(mocks.prefillPlacementLesson).toHaveBeenCalledWith(lessons[1]);
    expect(mocks.navigate).toHaveBeenCalledWith('/#worksheet-form');
    expect(mocks.claimPlacementReport).not.toHaveBeenCalled();
  });
  it('keeps the selected proposal through signup and prepares it only after the exact learner is claimed', async () => {
    mocks.registered = true;
    mocks.getPlacementReport.mockResolvedValue({ ...report, nextSteps: { status: 'ready', suggestions: lessons } });
    mocks.claimPlacementReport.mockResolvedValue({ studentId: 'owned-student', testId: 'exact-test' });
    mocks.pendingPlacementLessonId.mockReturnValue('lesson-2');
    await act(async () => { renderer = create(<PlacementReportPage />); });
    const save = renderer?.root.findAllByType('button').filter(b => b.children.some(c => typeof c === 'string' && c.includes('Add student and prepare')));
    await act(async () => { save?.[1].props.onClick(); });
    expect(mocks.rememberPlacementLesson).toHaveBeenCalledWith(mocks.token, 'lesson-2');
    expect(mocks.claimPlacementReport).toHaveBeenCalledWith(mocks.token);
    expect(mocks.prefillPlacementLesson).toHaveBeenCalledWith(lessons[1], { id: 'owned-student', name: 'Anna' });
  });
  it('blocks lesson generation while the placement diagnostic is not ready', async () => {
    mocks.getPlacementReport.mockResolvedValue({ ...report, teacherDiagnostic: undefined });
    await act(async () => { renderer = create(<PlacementReportPage />); });
    const generate = renderer?.root.findAllByType('button').find(b => b.children.some(c => typeof c === 'string' && c.includes('Generate 3')));
    expect(generate?.props.disabled).toBe(true);
    expect(mocks.generatePlacementNextSteps).not.toHaveBeenCalled();
  });
  it('renders full AI analysis, skills, goals, questions and top+bottom claim CTAs without Sample view', async () => {
    mocks.getPlacementReport.mockResolvedValue({
      role: 'teacher',
      studentName: 'Anna',
      result: baseResult,
      expiresAt: baseResult.expiresAt,
      claimed: false,
      teacherDiagnostic: fullDiagnostic,
    });

    await act(async () => { renderer = create(<PlacementReportPage />); });
    const rendered = textOf(renderer);
    expect(rendered).toContain('Strong vocabulary for workplace topics, with recurring past tense gaps.');
    expect(rendered).toContain('Focus Lesson 1 on Past Simple vs Present Perfect in status updates');
    expect(rendered).toContain('Choose the correct form: We ___ the report yesterday.');
    expect(rendered).toContain('have sent');
    expect(rendered).toContain('sent');
    expect(rendered).toContain('Past tense accuracy in status updates');
    expect(rendered).not.toContain('Sample view');
    expect(rendered.match(/Create free account and add /g)?.length).toBe(2);
  });

  it('shows Analysing results banner while background processing is still running', async () => {
    mocks.getPlacementReport.mockResolvedValue({
      role: 'teacher',
      studentName: 'Anna',
      result: baseResult,
      expiresAt: baseResult.expiresAt,
      claimed: false,
      teacherDiagnostic: {
        ...fullDiagnostic,
        test: { ...fullDiagnostic.test!, status: 'completed', reviewed_at: null },
        learningProfile: null,
      },
    });

    await act(async () => { renderer = create(<PlacementReportPage />); });
    expect(textOf(renderer)).toContain('Analysing results...');
  });

  it('falls back to PlacementReportBody for legacy reports without teacherDiagnostic and never shows Sample view', async () => {
    mocks.getPlacementReport.mockResolvedValue({
      role: 'teacher',
      studentName: 'Anna',
      result: baseResult,
      expiresAt: baseResult.expiresAt,
      claimed: false,
    });

    await act(async () => { renderer = create(<PlacementReportPage />); });
    const rendered = textOf(renderer);
    expect(rendered).toContain('Skill Scores');
    expect(rendered).not.toContain('Sample view');
  });

  it('never renders teacher diagnostic or claim banners in student view', async () => {
    mocks.getPlacementReport.mockResolvedValue({
      role: 'student',
      studentName: 'Anna',
      result: baseResult,
      expiresAt: baseResult.expiresAt,
      claimed: false,
    });

    await act(async () => { renderer = create(<PlacementReportPage />); });
    const rendered = textOf(renderer);
    expect(rendered).toContain('Well done, ');
    expect(rendered).not.toContain('AI Analysis');
    expect(rendered).not.toContain('Create free account and add');
    expect(rendered).not.toContain('Generate learning path');
  });
});