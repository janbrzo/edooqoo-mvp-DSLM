import { CheckCircle, MessageCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatWelcomeTestAnswer, isWelcomeTestIdk } from '@/lib/welcomeTest/answerDisplay';
import type { TeacherPlacementDiagnostic } from '@/lib/welcomeTest/placementReportApi';

type DiagnosticQuestion = TeacherPlacementDiagnostic['questions'][number];

function formatKeyAnswer(answer: unknown): string {
  if (typeof answer === 'boolean') return answer ? 'True' : 'False';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object' && answer !== null) return JSON.stringify(answer);
  return String(answer);
}

function hasNonEmptyKey(correctAnswer: unknown): boolean {
  return Boolean(correctAnswer && correctAnswer !== '' && correctAnswer !== '""');
}

function isUnuploadedRecording(answer: unknown): boolean {
  return typeof answer === 'string' && /^recording_\d+/.test(answer) && !answer.startsWith('http');
}

function DiagnosticQuestionItem({ question, index }: { question: DiagnosticQuestion; index: number }) {
  const hasAnswer = question.student_answer !== null && question.student_answer !== undefined && question.student_answer !== '';
  const hasKey = hasNonEmptyKey(question.correct_answer);
  const showCorrectness = hasKey && hasAnswer;
  const qData = question.question_data as Record<string, unknown> | null;
  const transcription = typeof qData?.transcription === 'string' ? qData.transcription : null;

  const borderClass = showCorrectness && question.is_correct === true
    ? 'border-primary/30 bg-primary/5'
    : showCorrectness && question.is_correct === false
      ? 'border-destructive/30 bg-destructive/5'
      : 'bg-muted/30';

  return (
    <article className={`rounded-xl border p-3 sm:p-4 ${borderClass}`} aria-label={`Question ${index + 1}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">{question.question_type.replace(/_/g, ' ')}</Badge>
            {question.element_type && <Badge variant="secondary" className="text-xs">{question.element_type}</Badge>}
            {question.difficulty_level && <Badge variant="outline" className="text-xs">{question.difficulty_level}</Badge>}
            {hasKey && hasAnswer && question.is_correct === null && !isWelcomeTestIdk(question.student_answer) && (
              <Badge variant="outline" className="text-xs">Needs review</Badge>
            )}
            {showCorrectness && question.is_correct === true && <CheckCircle className="h-4 w-4 text-primary" aria-label="Correct answer" />}
            {showCorrectness && question.is_correct === false && <XCircle className="h-4 w-4 text-destructive" aria-label="Incorrect answer" />}
          </div>

          <p className="text-sm leading-6">{question.question_text}</p>

          {hasAnswer ? (
            <div className="space-y-1 text-sm">
              {isUnuploadedRecording(question.student_answer) ? (
                <p className="text-xs text-muted-foreground">Speaking recording stayed on the student&apos;s device.</p>
              ) : (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
                  <span className="shrink-0 text-muted-foreground">Student&apos;s answer:</span>
                  <span className={showCorrectness && question.is_correct === true ? 'font-medium text-primary' : showCorrectness && question.is_correct === false ? 'text-destructive' : ''}>
                    {formatWelcomeTestAnswer(question.student_answer)}
                  </span>
                </div>
              )}
              {transcription && (
                <p className="rounded bg-muted/50 p-2 text-xs italic text-muted-foreground">&ldquo;{transcription}&rdquo;</p>
              )}
              {showCorrectness && question.is_correct === false && hasKey && (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
                  <span className="shrink-0 text-muted-foreground">Correct answer:</span>
                  <span className="font-medium text-primary">{formatKeyAnswer(question.correct_answer)}</span>
                </div>
              )}
              {question.explanation && <p className="pt-1 text-xs italic text-muted-foreground">{question.explanation}</p>}
              {question.ai_feedback && <p className="rounded-lg bg-background/80 p-2 text-xs text-muted-foreground">{question.ai_feedback}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not answered</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function TeacherPlacementQuestionsCard({ questions }: { questions: DiagnosticQuestion[] }) {
  if (questions.length === 0) return null;
  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
          Questions ({questions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.map((question, index) => (
          <DiagnosticQuestionItem key={question.id} question={question} index={index} />
        ))}
      </CardContent>
    </Card>
  );
}