import { useId, useState } from 'react';
import { ChevronDown, ClipboardList, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EVIDENCE_LABELS, evidenceFacts } from '@/lib/dslm/recommendationEvidenceView';
import type { RecommendationExplanation } from '@/lib/dslm/recommendationExplainability';

interface WhyThisLessonBannerProps {
  explanation: RecommendationExplanation;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Generated text remains a proposal, never presented as verified evidence. */
  rationale?: string | null;
}

export function EvidenceBadge({ explanation }: { explanation: RecommendationExplanation }) {
  if (!explanation.primary) return null;
  return (
    <Badge variant="outline" className="max-w-full gap-1 rounded-md border-primary/20 bg-primary/5 text-foreground font-normal">
      <ClipboardList className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="break-words">{EVIDENCE_LABELS[explanation.primary.type]}</span>
    </Badge>
  );
}

/** One disclosure level, no extra AI request and no percentage confidence badge. */
export function WhyThisLessonBanner({ explanation, loading, error, onRetry, rationale }: WhyThisLessonBannerProps) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2 border-l-2 border-primary/30 pl-3 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 id={headingId} className="text-xs font-semibold text-foreground">Why This Lesson?</h3>
        {!loading && !error && <EvidenceBadge explanation={explanation} />}
      </div>
      {loading ? (
        <div role="status" aria-label="Loading lesson evidence"><Skeleton className="h-4 w-full max-w-sm" /></div>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground" role="status">
          <span>Skill evidence is unavailable.</span>
          {onRetry && <Button type="button" variant="ghost" size="sm" onClick={onRetry}><RefreshCw className="h-3 w-3" />Retry</Button>}
        </div>
      ) : (
        <p className="break-words leading-relaxed text-muted-foreground">
          {explanation.summary || 'No linked evidence is available for this suggestion yet.'}
        </p>
      )}
      {!loading && (explanation.evidence.length > 0 || rationale?.trim()) && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="link" size="sm" className="h-auto max-w-full whitespace-normal px-0 py-0 text-xs">
              {open ? 'Hide evidence breakdown' : 'Show evidence breakdown'}
              <ChevronDown className={cn('h-3 w-3 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {!error && explanation.evidence.length > 0 && (
              <ul className="space-y-3">
                {explanation.evidence.map((item, index) => (
                  <li key={`${item.type}-${index}`} className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-foreground">{EVIDENCE_LABELS[item.type]}</p>
                    <p className="break-words text-sm text-muted-foreground">{item.summary}</p>
                    {evidenceFacts(item).length > 0 && <p className="break-words text-xs text-muted-foreground">{evidenceFacts(item).join(' · ')}</p>}
                  </li>
                ))}
              </ul>
            )}
            {rationale?.trim() && (
              <div className="space-y-1 border-t border-border pt-2">
                <p className="text-xs font-medium text-foreground">Suggested rationale</p>
                <p className="break-words text-sm text-muted-foreground">{rationale}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}