/**
 * PacingProposalsBell — DSLM v4.9
 *
 * Header bell for teachers showing all pending pacing proposals across all
 * students. Click → popover with accept/reject per proposal.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Gauge, Check, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePacingProposals, triggerLabel } from '@/hooks/usePacingProposals';
import { pacingLabel } from './PacingModeSlider';
import { formatDistanceToNow } from 'date-fns';

const bucketColor = (v: number) => {
  if (v <= 30) return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
  if (v >= 70) return 'bg-orange-500/15 text-orange-700 border-orange-500/30';
  return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
};

export const PacingProposalsBell: React.FC = () => {
  const { proposals, accept, reject, count } = usePacingProposals();

  if (count === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 relative gap-1.5">
          <Gauge className="h-3.5 w-3.5" />
          <span className="text-[11px]">Pacing</span>
          <Badge className="h-4 min-w-4 p-0 px-1 text-[10px] bg-primary text-primary-foreground">
            {count}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Pacing Proposals</span>
          <span className="text-[10px] text-muted-foreground">{count} pending</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {proposals.map(p => {
            const delta = p.proposed_pacing - p.current_pacing;
            return (
              <div key={p.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/student/${p.student_id}?tab=dslm`}
                      className="text-xs font-semibold text-foreground hover:underline flex items-center gap-1"
                    >
                      {p.student_name}
                      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                    </Link>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {triggerLabel(p.trigger_type)} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                  <Badge variant="outline" className={cn('text-[9px] py-0 h-4', bucketColor(p.current_pacing))}>
                    {pacingLabel(p.current_pacing)} · {p.current_pacing}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className={cn('text-[9px] py-0 h-4', bucketColor(p.proposed_pacing))}>
                    {pacingLabel(p.proposed_pacing)} · {p.proposed_pacing}
                  </Badge>
                  <span className={cn('text-[9px] font-medium', delta > 0 ? 'text-orange-600' : 'text-blue-600')}>
                    ({delta > 0 ? '+' : ''}{delta})
                  </span>
                </div>

                {p.reasoning?.length > 0 && (
                  <ul className="space-y-0.5 pl-3.5 list-disc marker:text-muted-foreground/40">
                    {p.reasoning.slice(0, 3).map((r, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground leading-tight">{r}</li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-1.5 pt-0.5">
                  <Button size="sm" className="h-6 text-[10px] flex-1 gap-1" onClick={() => accept(p)}>
                    <Check className="h-2.5 w-2.5" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1 gap-1" onClick={() => reject(p)}>
                    <X className="h-2.5 w-2.5" /> Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
