import { bankQuestions } from '@/lib/welcomeTest/seed';
import {
  interpretIdk,
  interpretSelfAwareness,
  traitBasedOn,
  traitLabel,
  traitValueLabel,
  type TraitConfidence,
} from '@/lib/welcomeTest/traitLabels';
import type { PublicPlacementResult } from '@/lib/welcomeTest/publicPlacementTest';
import type { WelcomeQuestionType } from '@/types/welcomeTest';

const SKILL_LABEL: Record<string, string> = {
  grammar: 'grammar accuracy', vocabulary: 'vocabulary range',
  reading: 'reading comprehension', listening: 'listening comprehension',
};

const FIRST_LESSON_FOCUS: Record<string, string> = {
  grammar: 'a short grammar-in-context worksheet built on everyday work situations',
  vocabulary: 'a topic vocabulary worksheet with collocations the student can use right away',
  reading: 'a short authentic reading with comprehension and discussion tasks',
  listening: 'a listening-based worksheet with a short dialogue and follow-up speaking',
};

export interface PlacementPreviewAiSummary {
  summary: string;
  keyObservations: string[];
  recommendations: string[];
  writingQuality: 'basic' | 'intermediate' | 'advanced';
}

export interface PlacementPreviewTrait {
  key: string;
  label: string;
  value: string;
  basedOn: string | null;
  confidence: TraitConfidence | null;
}

export interface PlacementPreviewTraitGroup {
  id: string;
  title: string;
  traits: PlacementPreviewTrait[];
}

export interface PlacementPreviewSampleQuestion {
  id: string;
  questionType: WelcomeQuestionType;
  elementType: string | null;
  questionText: string;
  description: string | null;
  options: string[];
  studentAnswer: string;
  isCorrect: boolean | null;
  correctAnswer: string | null;
  teacherNote: string;
  teacherNotePlaceholder: string;
}

export interface PlacementAccountPreview {
  goals: string[];
  firstLesson: string | null;
  level: string | null;
  aiSummary: PlacementPreviewAiSummary;
  traitsData: PlacementPreviewTraitGroup[];
  sampleQuestions: PlacementPreviewSampleQuestion[];
}

const SAMPLE_AI_SUMMARY: PlacementPreviewAiSummary = {
  summary: 'The learner communicates confidently about familiar work topics, but accuracy drops in less familiar situations. Their stated goals and scenario responses support a practical, work-focused learning plan.',
  keyObservations: [
    'Stronger listening than grammar accuracy suggests a useful starting point for guided speaking.',
    'The learner prefers practical correction after finishing a thought.',
    'Study-time answers support regular short practice between lessons.',
  ],
  recommendations: [
    'Start with short work-related speaking tasks and recycle useful phrases.',
    'Focus grammar practice on one recurring accuracy point at a time.',
    'Use brief between-lesson practice to reinforce new vocabulary.',
  ],
  writingQuality: 'intermediate',
};

const LOW_CONFIDENCE: TraitConfidence = {
  level: 'low',
  chip: 'Low confidence (1 answer)',
  note: 'Based on 1 answer',
};

const MEDIUM_CONFIDENCE: TraitConfidence = {
  level: 'medium',
  chip: 'Medium confidence (several answers)',
  note: 'Based on several answers',
};

interface SampleTraitSpec {
  key: string;
  value: string;
  label?: string;
  basedOn?: string;
  confidence?: TraitConfidence | null;
}

interface SampleTraitGroupSpec {
  id: string;
  title: string;
  traits: SampleTraitSpec[];
}

const SAMPLE_TRAIT_GROUPS: SampleTraitGroupSpec[] = [
  {
    id: 'motivation',
    title: 'Motivation',
    traits: [
      { key: 'self_assessed_level', value: 'A2-B1' },
      { key: 'motivation_type', value: 'instrumental' },
      { key: 'usage_context', value: 'work_formal, travel' },
      { key: 'latent_goal', value: 'career_critical' },
      { key: 'career_english_importance', value: 'high' },
      { key: 'learning_timeline', value: 'ongoing_important' },
    ],
  },
  {
    id: 'learning-style',
    title: 'Learning style',
    traits: [
      { key: 'weekly_study_time', value: '2_3_hours' },
      { key: 'deadline_response', value: 'pragmatic_coping' },
      { key: 'homework_commitment', value: 'high' },
      { key: 'persistence_level', value: 'high' },
      { key: 'plateau_response', value: 'adaptive' },
      { key: 'preferred_input_channel', value: 'auditory' },
      { key: 'reading_strategy', value: 'context_guesser' },
    ],
  },
  {
    id: 'feedback',
    title: 'Feedback',
    traits: [
      { key: 'feedback_preference', value: 'delayed_discussion' },
      { key: 'correction_preference', value: 'delayed' },
    ],
  },
  {
    id: 'feelings',
    title: 'Feelings about English',
    traits: [
      { key: 'anxiety_level', value: 'medium' },
      { key: 'ambiguity_tolerance', value: 'high' },
      { key: 'error_attitude', value: 'cautious' },
    ],
  },
  {
    id: 'self-awareness',
    title: 'Self-awareness',
    traits: [
      {
        key: 'admits_not_knowing',
        label: 'Admits not knowing',
        value: '75%',
        basedOn: interpretSelfAwareness(75),
        confidence: MEDIUM_CONFIDENCE,
      },
      {
        key: 'idk_answers',
        label: '"I don\'t know" answers',
        value: '3 total, 2 on skill questions',
        basedOn: interpretIdk(3, 2),
        confidence: MEDIUM_CONFIDENCE,
      },
    ],
  },
  {
    id: 'intensity',
    title: 'Intensity',
    traits: [
      {
        key: 'learning_path_intensity',
        label: 'Learning Path Intensity',
        value: 'Accelerated (75/100)',
        basedOn: 'Example combination of goals, study capacity and scenario reactions',
        confidence: MEDIUM_CONFIDENCE,
      },
    ],
  },
];

function buildSampleTraits(): PlacementPreviewTraitGroup[] {
  return SAMPLE_TRAIT_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    traits: group.traits.map((trait) => ({
      key: trait.key,
      label: trait.label ?? traitLabel(trait.key),
      value: traitValueLabel(trait.key, trait.value),
      basedOn: trait.basedOn ?? traitBasedOn(trait.key),
      confidence: trait.confidence === undefined
        ? { ...LOW_CONFIDENCE }
        : trait.confidence
          ? { ...trait.confidence }
          : null,
    })),
  }));
}

const SAMPLE_QUESTION_SPECS = [
  { id: 'wt_q22', studentAnswer: 'had left', isCorrect: true },
  {
    id: 'wt_q12',
    studentAnswer: 'I understand meetings, but I freeze when I need to explain a decision to a client.',
    isCorrect: null,
  },
  {
    id: 'wt_q13c',
    studentAnswer: 'Change the method, teacher, or approach',
    isCorrect: null,
  },
] as const;

function buildSampleQuestions(): PlacementPreviewSampleQuestion[] {
  const questionsById = new Map(bankQuestions().map((question) => [question.id, question]));
  return SAMPLE_QUESTION_SPECS.flatMap((spec) => {
    const question = questionsById.get(spec.id);
    if (!question) return [];
    const correctAnswer = Array.isArray(question.correct_answer)
      ? question.correct_answer.join(' / ')
      : question.correct_answer ?? null;
    return [{
      id: question.id,
      questionType: question.question_type,
      elementType: question.element_type ?? null,
      questionText: question.question_text,
      description: question.description ?? null,
      options: [...(question.options ?? [])],
      studentAnswer: spec.studentAnswer,
      isCorrect: spec.isCorrect,
      correctAnswer,
      teacherNote: '',
      teacherNotePlaceholder: 'Add a note about this answer...',
    }];
  });
}

/**
 * Goals and the first lesson mirror what claim creates from THIS student's report.
 * AI analysis, traits and questions are fixed illustrative content for the labelled
 * sample view. They never represent this student's answers or an AI evaluation.
 */
export function buildPlacementAccountPreview(result: PublicPlacementResult): PlacementAccountPreview {
  const scored = Object.entries(result.skills)
    .flatMap(([key, value]) => typeof value?.score === 'number' ? [{ key, score: value.score }] : [])
    .sort((a, b) => b.score - a.score);
  const strongest = scored[0]?.key ?? null;
  const weakest = scored.length > 1 ? scored[scored.length - 1].key : null;
  const goals: string[] = [];
  if (weakest) goals.push(`Improve ${SKILL_LABEL[weakest] ?? weakest}`);
  if (strongest && strongest !== weakest) goals.push(`Build confidence from ${SKILL_LABEL[strongest] ?? strongest}`);
  const focus = weakest ?? strongest;
  return {
    goals,
    firstLesson: focus ? FIRST_LESSON_FOCUS[focus] ?? null : null,
    level: result.level,
    aiSummary: {
      ...SAMPLE_AI_SUMMARY,
      keyObservations: [...SAMPLE_AI_SUMMARY.keyObservations],
      recommendations: [...SAMPLE_AI_SUMMARY.recommendations],
    },
    traitsData: buildSampleTraits(),
    sampleQuestions: buildSampleQuestions(),
  };
}
