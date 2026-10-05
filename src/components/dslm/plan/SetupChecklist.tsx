/**
 * SetupChecklist — the Learning plan for a student without lesson suggestions.
 *
 * Four steps in dependency order (Goal → Level check → Roadmap → Next lessons).
 * Only the first actionable step gets the primary button; every step can be
 * done at any time, so there are no "Skip" buttons. The checklist disappears
 * as soon as the first suggestion exists.
 */
import React from 'react';
import { Check, Copy, Loader2, Map, Plus, Send, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRelativeAge } from '@/lib/students/prepPlan';
import type { SetupStep, SetupStepKey, WelcomeTestState } from '@/lib/dslm/modelReadiness';
import { PlanSection } from './PlanSection';

export interface SetupChecklistProps {
  studentName: string;
  steps: readonly SetupStep[];
  nextStepKey: SetupStepKey | null;
  mainGoalLabel: string | null;
  activeGoalsCount: number;
  welcomeTest: { state: WelcomeTestState; sentAt: string | null };
  phasesCount: number;
  currentPhaseCaption: string | null;
  testBusy: boolean;
  roadmapBusy: boolean;
  suggestionsBusy: boolean;
  onSetMainGoal: () => void;
  onAddGoal: () => void;
  onManageGoals: () => void;
  onSendTest: () => void;
  onCopyTestLink: () => void;
  onOpenTestResults: () => void;
  onGenerateRoadmap: () => void;
  onOpenRoadmap: () => void;
  onGetSuggestions: () => void;
}

const STEP_TITLE: Record<SetupStepKey, string> = {
  goal: 'Goal',
  test: 'Level check',
  roadmap: 'Roadmap',
  suggestions: 'Next lessons',
};

const STEP_SPOTLIGHT: Partial<Record<SetupStepKey, string>> = {
  test: 'send-welcome-test',
  roadmap: 'learning-roadmap',
  suggestions: 'next-lesson-ideas',
};

function sentAgo(iso: string | null): string {
  const age = formatRelativeAge(iso);
  if (!age) return 'sent';
  return `sent ${age.charAt(0).toLowerCase()}${age.slice(1)}`;
}

export const SetupChecklist: React.FC<SetupChecklistProps> = (props) => {
  const firstName = props.studentName.split(' ')[0] || props.studentName;
  const stepsBeforeLessonsDone = props.steps
    .filter((step) => step.key !== 'suggestions')
    .every((step) => step.done);

  const variantFor = (key: SetupStepKey) => (props.nextStepKey === key ? 'default' : 'outline');

  const renderBody = (step: SetupStep): { detail: React.ReactNode; actions: React.ReactNode } => {
    switch (step.key) {
      case 'goal':
        return {
          detail: props.mainGoalLabel
            ? props.mainGoalLabel
            : props.activeGoalsCount > 0
              ? `${props.activeGoalsCount} goal${props.activeGoalsCount === 1 ? '' : 's'} set`
              : `What does ${firstName} need English for?`,
          actions: (
            <>
              {!props.mainGoalLabel && (
                <Button size="sm" variant={variantFor('goal')} onClick={props.onSetMainGoal}>
                  <Target className="mr-1.5 h-4 w-4" aria-hidden="true" /> Set main goal
                </Button>
              )}
              {props.activeGoalsCount === 0 ? (
                <Button size="sm" variant="ghost" onClick={props.onAddGoal}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add a specific goal
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={props.onManageGoals}>
                  Manage goals
                </Button>
              )}
            </>
          ),
        };
      case 'test':
        if (props.welcomeTest.state === 'completed') {
          return {
            detail: 'Placement test completed',
            actions: (
              <Button size="sm" variant="ghost" onClick={props.onOpenTestResults}>
                See results
              </Button>
            ),
          };
        }
        if (props.welcomeTest.state === 'sent') {
          return {
            detail: `Waiting for ${firstName} · ${sentAgo(props.welcomeTest.sentAt)}`,
            actions: (
              <>
                <Button size="sm" variant="outline" onClick={props.onSendTest} disabled={props.testBusy}>
                  {props.testBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                  Resend email
                </Button>
                <Button size="sm" variant="ghost" onClick={props.onCopyTestLink} disabled={props.testBusy}>
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" /> Copy link
                </Button>
              </>
            ),
          };
        }
        return {
          detail: `10-minute placement test. ${firstName} gets it by email.`,
          actions: (
            <>
              <Button size="sm" variant={variantFor('test')} onClick={props.onSendTest} disabled={props.testBusy}>
                {props.testBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                Send Welcome Test
              </Button>
              <Button size="sm" variant="ghost" onClick={props.onCopyTestLink} disabled={props.testBusy}>
                <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" /> Copy link
              </Button>
            </>
          ),
        };
      case 'roadmap':
        if (step.done) {
          return {
            detail: `${props.phasesCount} phase${props.phasesCount === 1 ? '' : 's'}${props.currentPhaseCaption ? ` · now: ${props.currentPhaseCaption}` : ''}`,
            actions: (
              <Button size="sm" variant="ghost" onClick={props.onOpenRoadmap}>
                <Map className="mr-1.5 h-4 w-4" aria-hidden="true" /> View roadmap
              </Button>
            ),
          };
        }
        return {
          detail: 'Phases from today to the goal, so lessons come in a sensible order.',
          actions: (
            <Button size="sm" variant={variantFor('roadmap')} onClick={props.onGenerateRoadmap} disabled={props.roadmapBusy}>
              {props.roadmapBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Map className="mr-1.5 h-4 w-4" aria-hidden="true" />}
              Generate roadmap
            </Button>
          ),
        };
      case 'suggestions':
      default:
        return {
          detail: stepsBeforeLessonsDone
            ? 'Lesson suggestions you approve. Prep shows the first one.'
            : 'Lesson suggestions you approve. Works now — sharper after the steps above.',
          actions: (
            <Button size="sm" variant={variantFor('suggestions')} onClick={props.onGetSuggestions} disabled={props.suggestionsBusy}>
              {props.suggestionsBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />}
              Get lesson suggestions
            </Button>
          ),
        };
    }
  };

  return (
    <PlanSection id="plan-setup" title="One-time setup">
      <ol className="divide-y divide-border rounded-lg border border-border bg-card">
        {props.steps.map((step, index) => {
          const { detail, actions } = renderBody(step);
          const spotlight = step.key === 'test' && props.welcomeTest.state === 'completed'
            ? undefined
            : STEP_SPOTLIGHT[step.key];
          return (
            <li
              key={step.key}
              data-spotlight={spotlight}
              data-testid={`plan-setup-${step.key}`}
              className="flex gap-3 p-4"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  step.done
                    ? 'border-emerald-600 bg-emerald-600 text-primary-foreground dark:border-emerald-500 dark:bg-emerald-500'
                    : props.nextStepKey === step.key
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground',
                )}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {STEP_TITLE[step.key]}
                    <span className="sr-only">{step.done ? ' (done)' : step.waiting ? ' (waiting)' : ' (to do)'}</span>
                  </p>
                  <p className="break-words text-sm text-muted-foreground">{detail}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </PlanSection>
  );
};
