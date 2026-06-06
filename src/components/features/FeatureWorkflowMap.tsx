import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  PUBLIC_FEATURE_WORKFLOW,
  type PublicFeatureKey,
  type PublicFeatureWorkflowItem,
} from '@/constants/publicFeatureWorkflow';
import { cn } from '@/lib/utils';

interface FeatureWorkflowMapProps {
  activeKey?: PublicFeatureKey;
  className?: string;
  title?: string;
  subtitle?: string;
}

const phaseLabels: Record<PublicFeatureWorkflowItem['phase'], string> = {
  setup: 'Setup',
  decision: 'Prep decision',
  lesson: 'Lesson signals',
  access: 'Access and rhythm',
};

const phaseOrder: PublicFeatureWorkflowItem['phase'][] = ['setup', 'decision', 'lesson', 'access'];

const FeatureWorkflowMap: React.FC<FeatureWorkflowMapProps> = ({
  activeKey,
  className,
  title = 'Where this feature fits in Edooqoo',
  subtitle = 'Each feature is one part of the same student learning loop: setup, DSLM decision support, lesson-time signals, and the next prep cycle.',
}) => (
  <section className={cn('border-y border-border bg-secondary/20 py-10', className)}>
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-7 max-w-3xl">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {phaseOrder.map((phase, phaseIndex) => {
          const items = PUBLIC_FEATURE_WORKFLOW.filter((item) => item.phase === phase);
          return (
            <div key={phase} className="relative">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {phaseLabels[phase]}
                </p>
                {phaseIndex < phaseOrder.length - 1 && (
                  <ArrowRight className="hidden h-4 w-4 text-primary/50 lg:block" />
                )}
              </div>
              <div className="space-y-2">
                {items.map(({ key, label, path, icon: Icon, shortRole, description }) => {
                  const isActive = activeKey === key;
                  return (
                    <Link
                      key={key}
                      to={path}
                      className={cn(
                        'block rounded-xl border p-3 transition-all',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg'
                          : 'border-border bg-background hover:border-primary/30 hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            isActive ? 'bg-white/15' : 'bg-primary/10',
                          )}
                        >
                          <Icon className={cn('h-4 w-4', isActive ? 'text-primary-foreground' : 'text-primary')} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{label}</div>
                          <div className={cn('text-xs font-medium', isActive ? 'text-primary-foreground/80' : 'text-primary')}>
                            {shortRole}
                          </div>
                          <p className={cn('mt-1 text-xs leading-5', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                            {description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default FeatureWorkflowMap;

