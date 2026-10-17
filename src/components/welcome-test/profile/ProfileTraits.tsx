/**
 * Teacher-facing Welcome Test profile blocks: every trait with a readable
 * label, what it is based on and a confidence chip; self-awareness and
 * "I don't know" with one-line readings; the level states. Pure display:
 * the data comes from student_learning_profiles.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SELF_ASSESSMENT_ACCURACY_LABEL,
  TRAIT_GROUP_LABELS,
  TRAIT_META,
  interpretIdk,
  interpretSelfAwareness,
  selfAssessmentAccuracyLabel,
  traitBasedOn,
  traitConfidence,
  traitLabel,
  traitValueLabel,
  type TraitGroup,
} from '@/lib/welcomeTest/traitLabels';
import {
  describeLevelState,
  orderedTraitRows,
  readTraitEvidence,
  resolveProfileTraits,
  traitSignalKey,
} from '@/lib/welcomeTest/profileDisplay';
import { SignalFeedback } from './SignalFeedback';

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{children}</p>
);

export interface ProfileLike {
  [key: string]: unknown;
}

const GROUP_ORDER: TraitGroup[] = ['goals', 'habits', 'learning', 'feelings'];

/** All traits, grouped, each with a "based on" note, confidence chip and the Agree/Partly/Disagree control. */
export const ProfileTraits: React.FC<{ profile: ProfileLike }> = ({ profile }) => {
  const traits = resolveProfileTraits(profile);
  const evidence = readTraitEvidence(profile.raw_answers);
  const rows = orderedTraitRows(traits);
  if (rows.length === 0) return null;

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = TRAIT_META[row.key]?.group ?? 'other';
    grouped.set(group, [...(grouped.get(group) ?? []), row]);
  }
  const sections: Array<{ id: string; title: string }> = [
    ...GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => ({ id: g, title: TRAIT_GROUP_LABELS[g] })),
    ...(grouped.has('other') ? [{ id: 'other', title: 'Other signals' }] : []),
  ];

  return (
    <div className="space-y-3" data-testid="profile-traits">
      {sections.map(({ id, title }) => (
        <div key={id}>
          <SectionLabel>{title}</SectionLabel>
          <div className="rounded border divide-y">
            {(grouped.get(id) ?? []).map(({ key, value }) => {
              const confidence = traitConfidence(key, evidence);
              const basedOn = traitBasedOn(key);
              const shown = traitValueLabel(key, value);
              return (
                <div key={key} className="px-2 py-1.5 space-y-1" data-testid={`trait-${key}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{traitLabel(key)}</p>
                      <p className="text-sm font-medium">{shown}</p>
                    </div>
                    {confidence && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] shrink-0',
                          confidence.level === 'low' && 'border-amber-300 text-amber-700 dark:text-amber-400',
                        )}
                      >
                        {confidence.chip}
                      </Badge>
                    )}
                  </div>
                  {basedOn && (
                    <p className="text-[11px] text-muted-foreground">
                      {confidence ? `${confidence.note}: ` : 'Based on: '}{basedOn}
                    </p>
                  )}
                  <SignalFeedback signalKey={traitSignalKey(key)} signalValue={shown} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/** self_awareness_score and the "I don't know" counts, each with a one-line reading. */
export const AwarenessBlock: React.FC<{ profile: ProfileLike }> = ({ profile }) => {
  const score = profile.self_awareness_score;
  const total = profile.idk_count_total;
  const skill = profile.idk_count_skill;
  const hasScore = score !== undefined;
  const hasIdk = total !== undefined || skill !== undefined;
  if (!hasScore && !hasIdk) return null;
  const scoreNum = typeof score === 'number' ? score : null;
  return (
    <div data-testid="profile-awareness">
      <SectionLabel>Self-awareness</SectionLabel>
      <div className="rounded border divide-y text-xs">
        {hasScore && (
          <div className="px-2 py-1.5">
            <p>
              <span className="text-muted-foreground">Admits not knowing: </span>
              <span className="font-medium">{scoreNum !== null ? `${Math.round(scoreNum)}%` : '-'}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">{interpretSelfAwareness(scoreNum)}</p>
          </div>
        )}
        {hasIdk && (
          <div className="px-2 py-1.5">
            <p>
              <span className="text-muted-foreground">"I don't know" answers: </span>
              <span className="font-medium">
                {typeof total === 'number' ? total : 0} total, {typeof skill === 'number' ? skill : 0} on skill questions
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">{interpretIdk(total, skill)}</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface LevelBlockProps {
  profile: ProfileLike;
  /** student_tests.status of the Welcome Test being viewed, when known. */
  testStatus?: string | null;
  isWelcomeTest?: boolean;
}

/** Estimated vs self-assessed level, the accuracy of the self-assessment, and the insufficient/analysing states. */
export const LevelAssessmentBlock: React.FC<LevelBlockProps> = ({ profile, testStatus, isWelcomeTest }) => {
  const state = describeLevelState({
    estimatedLevel: typeof profile.estimated_level === 'string' ? profile.estimated_level : null,
    rawAnswers: profile.raw_answers,
    testStatus,
    isWelcomeTest,
  });
  const selfAssessed = typeof profile.self_assessed_level === 'string' && profile.self_assessed_level
    ? traitValueLabel('self_assessed_level', profile.self_assessed_level)
    : '-';
  const hasLevel = state.kind === 'level';
  const accuracy = typeof profile.level_confidence === 'string' ? profile.level_confidence : null;

  return (
    <div className="space-y-2" data-testid="profile-level">
      {state.kind === 'analysing' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {state.message}
        </p>
      )}
      {state.kind === 'insufficient' && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{state.message}</p>
      )}
      {state.kind === 'none' && <p className="text-sm text-muted-foreground">{state.message}</p>}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-primary/5 rounded-lg">
          <div className="text-2xl font-bold text-primary">{hasLevel ? state.level : '-'}</div>
          <div className="text-xs text-muted-foreground">Estimated Level</div>
        </div>
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold">{selfAssessed}</div>
          <div className="text-xs text-muted-foreground">Self-Assessed</div>
        </div>
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <Badge variant={accuracy === 'accurate' ? 'default' : accuracy === 'overestimates' ? 'destructive' : 'secondary'}>
            {selfAssessmentAccuracyLabel(accuracy)}
          </Badge>
          <div className="text-xs text-muted-foreground mt-1">{SELF_ASSESSMENT_ACCURACY_LABEL}</div>
        </div>
      </div>
    </div>
  );
};
