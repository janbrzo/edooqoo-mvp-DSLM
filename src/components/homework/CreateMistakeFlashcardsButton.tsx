import { Layers, Loader2, RotateCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHomeworkMistakeFlashcards } from '@/hooks/useHomeworkMistakeFlashcards';
import type { MistakeScope } from '@/lib/homework/mistakeFlashcardsApi';
import { safeReturnTo } from '@/lib/flashcards/safeReturnTo';

export function CreateMistakeFlashcardsButton({ scope, returnTo }: { scope: MistakeScope; returnTo: string }) {
  const { result, create, retry } = useHomeworkMistakeFlashcards(scope);
  if (!result) return null;
  if (result.status === 'loading') return <span role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking practice items...</span>;
  if (result.status === 'error') return (
    <div role="alert" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-destructive">Could not prepare mistake flashcards.</span>
      <Button variant="outline" size="sm" onClick={retry}><RotateCw /> Try again</Button>
    </div>
  );
  if (!result.count) return <p className="text-sm text-muted-foreground">No confirmed mistakes with a usable answer to practice.</p>;
  if (result.saved) {
    const params = new URLSearchParams({ mode: scope.audience === 'student' ? 'study' : 'browse', returnTo: safeReturnTo(returnTo, '/') });
    if (scope.audience === 'student' && scope.email) params.set('email', scope.email);
    return <div className="flex flex-wrap items-center gap-3">
      <span role="status" className="text-sm text-muted-foreground">{result.saved.created_count ? `${result.saved.created_count} flashcards added.` : 'These mistakes are already in your flashcard set.'}</span>
      <Button asChild variant="outline" size="sm"><a href={`/flashcards/${result.saved.share_token}?${params}`} target="_blank" rel="noopener noreferrer"><ArrowRight /> {scope.audience === 'student' ? 'Start practice' : 'Open flashcards'}</a></Button>
    </div>;
  }
  return <Button variant="outline" size="sm" disabled={result.status === 'saving'} className="h-auto min-h-9 whitespace-normal text-left" onClick={() => { void create(); }}>
    {result.status === 'saving' ? <Loader2 className="animate-spin" /> : <Layers />}
    {result.status === 'saving' ? 'Saving flashcards...' : `Practice Mistakes in Flashcards (${result.count})`}
  </Button>;
}