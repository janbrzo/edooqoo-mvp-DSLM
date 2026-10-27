import { useDemoContext } from '@/contexts/DemoContext';
import { usePlanEvidenceMetrics } from '@/hooks/dslm/usePlanEvidenceMetrics';
import { explainRecommendation, type ExplainableSuggestion, type ExplainabilityPhase } from '@/lib/dslm/recommendationExplainability';
import { WhyThisLessonBanner } from './WhyThisLessonBanner';

interface ConnectedWhyThisLessonProps {
  studentId: string;
  teacherId: string;
  suggestion: ExplainableSuggestion;
  phases?: readonly ExplainabilityPhase[];
  rationale?: string | null;
}

/** Same cached metrics query as the Learning plan; no goal/note/test provenance guesses. */
export function ConnectedWhyThisLesson({ studentId, teacherId, suggestion, phases, rationale }: ConnectedWhyThisLessonProps) {
  const { isDemoMode } = useDemoContext();
  const signals = usePlanEvidenceMetrics(isDemoMode ? '' : studentId, isDemoMode ? '' : teacherId);
  if (isDemoMode) return null;
  const explanation = explainRecommendation({ suggestion, now: Date.now(), metrics: signals.error ? [] : signals.rawMetrics, phases });
  return <WhyThisLessonBanner key={suggestion.id} explanation={explanation} loading={signals.loading} error={signals.error}
    onRetry={() => { void signals.refetch(); }} rationale={rationale} />;
}