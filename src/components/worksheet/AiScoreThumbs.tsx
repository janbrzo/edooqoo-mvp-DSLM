/**
 * Small thumbs up/down next to an AI-prefilled Mark done value: "was this AI
 * score right?". Optimistic; a failed save reverts the icon and shows a toast.
 */
import React from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AiScoreThumbsProps {
  /** Current vote: true up, false down, undefined none. */
  value: boolean | undefined;
  onVote: (thumbsUp: boolean) => Promise<string | null>;
}

export const AiScoreThumbs: React.FC<AiScoreThumbsProps> = ({ value, onVote }) => {
  const [local, setLocal] = React.useState<boolean | undefined>(value);
  React.useEffect(() => { setLocal(value); }, [value]);

  const vote = async (up: boolean) => {
    if (local === up) return;
    const before = local;
    setLocal(up);
    const err = await onVote(up);
    if (err) {
      setLocal(before);
      toast.error('Could not save your feedback on the AI score.');
    }
  };

  const btn = 'p-0.5 rounded hover:bg-muted transition-colors';
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-label="Was the AI score right?">
      <button type="button" className={cn(btn, local === true ? 'text-green-600' : 'text-muted-foreground/60')}
        title="AI score looks right" aria-pressed={local === true} onClick={() => vote(true)}>
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button type="button" className={cn(btn, local === false ? 'text-red-600' : 'text-muted-foreground/60')}
        title="AI score looks wrong" aria-pressed={local === false} onClick={() => vote(false)}>
        <ThumbsDown className="h-3 w-3" />
      </button>
    </span>
  );
};
