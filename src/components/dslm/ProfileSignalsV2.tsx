/**
 * Welcome Test profile v2 blocks for the teacher Profile view (iteration 5):
 * declared vs measured, learning path (intensity), answer behaviour and the
 * low coverage badge. Every block hides itself when its data is missing, so
 * old profiles render exactly as before.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DivergenceSeverity, LearningProfileV2Columns } from '@/types/dslm/learningProfileV2';
import {
  describeAnswerBehaviour,
  describeLearningPath,
  isLowSignalCoverage,
  resolveLearningPath,
  resolveSignalCoverage,
  toDivergenceRows,
} from '@/lib/dslm/learningProfileView';
import { formatDivergenceText } from '@/lib/welcomeTest/traitLabels';
import { LEARNING_PATH_SIGNAL_KEY, divergenceSignalKeys } from '@/lib/welcomeTest/profileDisplay';
import { SignalFeedback } from '@/components/welcome-test/profile/SignalFeedback';

const SEVERITY_CLASS: Record<DivergenceSeverity, string> = {
  info: 'border-border text-muted-foreground',
  notable: 'border-amber-300 text-amber-700 dark:text-amber-400',
  strong: 'border-red-300 text-red-700 dark:text-red-400',
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{children}</p>
);

export const LowCoverageBadge: React.FC<{ profile: LearningProfileV2Columns }> = ({ profile }) => {
  const coverage = resolveSignalCoverage(profile);
  if (!isLowSignalCoverage(coverage)) return null;
  return (
    <Badge
      variant="outline"
      className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400"
      title={`Only ${Math.round((coverage ?? 0) * 100)}% of the profile signals were answered; treat these hints with care.`}
    >
      Low signal coverage
    </Badge>
  );
};

export const DeclaredVsMeasured: React.FC<{ profile: LearningProfileV2Columns }> = ({ profile }) => {
  const rows = toDivergenceRows(profile.divergences);
  if (!rows) return null;
  const rawPairs = (Array.isArray(profile.divergences) ? profile.divergences : []).map((d) =>
    d && typeof d === 'object' && typeof d.pair === 'string' ? d.pair : '');
  const feedbackKeys = divergenceSignalKeys(rawPairs);
  return (
    <div data-testid="profile-divergences">
      <SectionLabel>Declared vs measured</SectionLabel>
      <div className="rounded border divide-y">
        {rows.map((row) => {
          const text = formatDivergenceText({ declared: row.rawDeclared, observed: row.rawObserved });
          return (
            <div key={row.key} className="px-2 py-1.5 space-y-1 text-xs">
              <div className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-start gap-2">
                <span className="font-medium">{row.label}</span>
                <span className="min-w-0">
                  <span className="text-muted-foreground">Declared:</span> {text?.declared ?? row.declared}
                  <span className="text-muted-foreground"> · Observed:</span> {text?.observed ?? row.observed}
                </span>
                <Badge variant="outline" className={cn('text-[10px]', SEVERITY_CLASS[row.severity])}>
                  {row.severityLabel}
                </Badge>
              </div>
              <SignalFeedback
                signalKey={feedbackKeys[row.index] ?? `divergence:${row.pair}`}
                signalValue={text?.sentence ?? `${row.declared} | ${row.observed}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LearningPathBlock: React.FC<{ profile: LearningProfileV2Columns }> = ({ profile }) => {
  const view = describeLearningPath(resolveLearningPath(profile));
  if (!view) return null;
  return (
    <div data-testid="profile-learning-path">
      <SectionLabel>Learning path (intensity)</SectionLabel>
      <div className="rounded border p-2 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {view.pathLabel && <Badge variant="secondary" className="text-xs">{view.pathLabel}</Badge>}
          {view.score !== null && <span className="font-semibold">{view.score}/100</span>}
          {view.coveragePercent !== null && (
            <span className="text-muted-foreground">based on {view.coveragePercent}% of the signals</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          How intense the plan can be (phase length, homework load). This is separate from the Scientific/Pragmatic style slider.
        </p>
        {view.version < 2 && (
          <p className="text-[11px] text-muted-foreground">
            Older test: unanswered questions were counted as average, so treat this score as a rough hint.
          </p>
        )}
        {view.topComponents.length > 0 && (
          <p>
            <span className="text-muted-foreground">Strongest signals: </span>
            {view.topComponents.map((c) => `${c.label} ${c.score}`).join(', ')}
          </p>
        )}
        {view.overrides.length > 0 && (
          <ul className="list-disc pl-4 space-y-0.5">
            {view.overrides.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        )}
        {view.capacityWarning && (
          <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{view.capacityWarning}</span>
          </div>
        )}
        {view.pathLabel && (
          <SignalFeedback
            signalKey={LEARNING_PATH_SIGNAL_KEY}
            signalValue={view.score !== null ? `${view.pathLabel} (${view.score}/100)` : view.pathLabel}
          />
        )}
      </div>
    </div>
  );
};

export const AnswerBehaviourLine: React.FC<{ profile: LearningProfileV2Columns }> = ({ profile }) => {
  const parts = describeAnswerBehaviour(profile.answer_behaviour);
  if (!parts) return null;
  return (
    <div data-testid="profile-answer-behaviour">
      <SectionLabel>Answer behaviour</SectionLabel>
      <p className="text-xs">{parts.join(' · ')}</p>
    </div>
  );
};
