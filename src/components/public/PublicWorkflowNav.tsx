import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { PUBLIC_FEATURE_WORKFLOW, getPublicFeatureByPath } from '@/constants/publicFeatureWorkflow';
import { cn } from '@/lib/utils';

interface PublicWorkflowNavProps {
  className?: string;
}

const PublicWorkflowNav: React.FC<PublicWorkflowNavProps> = ({ className }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const fromState = { from: location.pathname + location.search };
  const active = getPublicFeatureByPath(location.pathname);

  const WorkflowLinks = ({ stacked = false }: { stacked?: boolean }) => (
    <div className={stacked ? 'flex flex-col gap-1' : 'hidden items-center gap-1 lg:flex'}>
      {PUBLIC_FEATURE_WORKFLOW.map(({ key, label, path, icon: Icon }) => {
        const isActive = active?.key === key || location.pathname === path;
        return (
          <Link
            key={key}
            to={path}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors',
              stacked && 'rounded-md px-3 py-2 text-sm',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <nav className={cn('sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md', className)}>
      {/* v6.9.39 P8 — full-width container + flex-1 left block pushes
          feature pills to the left next to the logo so the action cluster
          on the right no longer crushes them at ~1200px viewports. */}
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            to="/"
            className="shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-lg font-bold text-transparent"
          >
            edooqoo
          </Link>
          <WorkflowLinks />
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/how-it-works" state={fromState}>How it works</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/pricing" state={fromState}>Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/login" state={fromState}>Log in</Link>
          </Button>
          <Button asChild size="sm" className="relative rounded-full bg-violet-600 hover:bg-violet-700">
            <Link to="/signup" state={fromState}>
              Start Free <ArrowRight className="h-3.5 w-3.5" />
              <Badge className="absolute -right-2 -top-2 border-0 bg-green-500 px-1.5 py-0.5 text-[10px] text-white">
                2 FREE
              </Badge>
            </Link>
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <Button asChild size="sm" className="relative h-8 rounded-full bg-violet-600 px-3 text-xs hover:bg-violet-700">
            <Link to="/signup" state={fromState}>
              Start Free
              <Badge className="absolute -right-2 -top-2 border-0 bg-green-500 px-1 py-0 text-[9px] leading-tight text-white">
                2 FREE
              </Badge>
            </Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-4 pt-8">
                <div>
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Workflow
                  </p>
                  <WorkflowLinks stacked />
                </div>
                <div className="border-t border-border pt-3">
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start" onClick={() => setOpen(false)}>
                    <Link to="/how-it-works" state={fromState}>How it works</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start" onClick={() => setOpen(false)}>
                    <Link to="/pricing" state={fromState}>Pricing</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="mt-2 w-full" onClick={() => setOpen(false)}>
                    <Link to="/login" state={fromState}>Log in</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default PublicWorkflowNav;
