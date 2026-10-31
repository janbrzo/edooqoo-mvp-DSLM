import { MessageSquare, Loader2, ExternalLink, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useStudentHomeworkFeedback, type HomeworkFeedbackScope } from '@/hooks/useStudentHomeworkFeedback';
import { CreateMistakeFlashcardsButton } from '@/components/homework/CreateMistakeFlashcardsButton';

interface Props {
  scope: HomeworkFeedbackScope | null;
  teacherName?: string;
  onClose: () => void;
}

export function HomeworkFeedbackModal({ scope, teacherName, onClose }: Props) {
  const { status, review, retry } = useStudentHomeworkFeedback(scope);
  const exerciseIndices = review
    ? [...new Set([...Object.keys(review.comments), ...Object.keys(review.verdicts)])]
      .map(Number).filter(index => Number.isInteger(index) && index >= 0)
      .filter(index => !!review.comments[index] || Object.keys(review.verdicts[index] ?? {}).length > 0)
      .sort((a, b) => a - b)
    : [];

  return (
    <Dialog open={!!scope} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle className="flex items-center gap-2 leading-normal tracking-normal">
            <MessageSquare className="h-5 w-5 shrink-0 text-primary" /> Teacher Feedback
          </DialogTitle>
          <DialogDescription className="break-words">{scope?.homework.title}{teacherName ? ` · ${teacherName}` : ''}</DialogDescription>
        </DialogHeader>
        {status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading feedback...
          </div>
        )}
        {status === 'error' && (
          <div role="alert" className="space-y-3 py-4">
            <p className="text-sm text-destructive">Could not load your teacher's feedback.</p>
            <Button variant="outline" size="sm" onClick={retry}><RotateCw /> Try again</Button>
          </div>
        )}
        {status === 'unavailable' && <p className="py-6 text-sm text-muted-foreground">Feedback is not available. Your teacher may have reopened this assignment.</p>}
        {status === 'ready' && exerciseIndices.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">Your teacher has reviewed this homework without adding comments or individual decisions.</p>
        )}
        {status === 'ready' && review && (
          <div className="divide-y">
            {exerciseIndices.map(index => (
              <section key={index} className="py-4 space-y-2">
                <h3 className="text-sm font-semibold">Exercise {index + 1}</h3>
                {review.comments[index] && <p className="text-sm whitespace-pre-wrap break-words">{review.comments[index]}</p>}
                {Object.entries(review.verdicts[index] ?? {}).sort(([a], [b]) => Number(a) - Number(b)).map(([question, verdict]) => (
                  <p key={question} className="text-sm flex flex-wrap gap-x-2">
                    <span className="text-muted-foreground">Question {Number(question) + 1}:</span>
                    <span>{verdict === 'correct' ? '✓ Correct' : '✗ Needs practice'}</span>
                  </p>
                ))}
              </section>
            ))}
          </div>
        )}
        {scope && (
          <div className="border-t pt-4">
            <Button asChild variant="outline" size="sm">
              <a href={`/homework/${scope.homework.share_token}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open Homework
              </a>
            </Button>
            {status === 'ready' && review && (
              <div className="mt-3">
                <CreateMistakeFlashcardsButton
                  key={JSON.stringify([scope.teacherToken, scope.email, scope.homework.id, scope.homework.reviewed_at])}
                  scope={{ homeworkId: scope.homework.id, revision: scope.homework.reviewed_at ?? '', audience: 'student', shareToken: scope.homework.share_token ?? undefined, email: scope.email }}
                  returnTo={`/my/${scope.teacherToken}/homework?feedback=${scope.homework.id}`}
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}