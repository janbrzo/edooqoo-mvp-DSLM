/**
 * CollapsibleSection — compact section wrapper with header trigger.
 * Used in Goals/Skills/Profile to densify layout while keeping content discoverable.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  count?: number;
  badge?: string;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title, icon: Icon, count, badge, defaultOpen = false, rightSlot, description, children, className,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={cn('overflow-hidden', className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-transparent data-[state=open]:border-border" data-state={open ? 'open' : 'closed'}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
              {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className="text-sm font-semibold truncate">{title}</span>
              {typeof count === 'number' && (
                <span className="text-xs text-muted-foreground">({count})</span>
              )}
              {badge && <Badge variant="outline" className="text-[10px] ml-1">{badge}</Badge>}
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground ml-auto transition-transform', open && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>
        <CollapsibleContent>
          <CardContent className="p-3 pt-3">
            {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
