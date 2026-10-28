/**
 * CompetencyRadarView (Pillar 2, Stage 2.3): the student's competency radar
 * with two mastery layers: stored mastery (audit trail) and estimated
 * retention after the shared forgetting curve. Categories are classified
 * into four zones; critical gaps and fading strengths offer a manual
 * "Add to next lesson" prefill (sessionStorage contract, never auto-fires
 * generation and never touches the worksheet engine).
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Radar as RadarIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import type { SkillMetric } from '@/hooks/useSkillMetrics';
import {
  buildCategoryCompetencies,
  buildRadarRows,
  weakestSkillInCategory,
  zoneCounts,
  ZONE_LABELS,
  type CompetencyZone,
} from '@/lib/dslm/competencyRadar';

interface CompetencyRadarViewProps {
  skills: readonly SkillMetric[];
}

const ZONE_ORDER: CompetencyZone[] = ['critical_gap', 'retention_alert', 'mastered', 'in_progress'];

const ZONE_BADGE_VARIANT: Record<CompetencyZone, 'destructive' | 'outline' | 'secondary'> = {
  critical_gap: 'destructive',
  retention_alert: 'outline',
  mastered: 'secondary',
  in_progress: 'secondary',
};

export function CompetencyRadarView({ skills }: CompetencyRadarViewProps) {
  const navigate = useNavigate();
  const { guardAction } = useDemoGuard();

  const competencies = useMemo(() => buildCategoryCompetencies(skills), [skills]);
  const radarRows = useMemo(() => buildRadarRows(competencies), [competencies]);
  const counts = useMemo(() => zoneCounts(competencies), [competencies]);

  const attention = useMemo(
    () =>
      competencies
        .filter((c) => c.zone === 'critical_gap' || c.zone === 'retention_alert')
        .flatMap((competency) => {
          const focus = weakestSkillInCategory(skills, competency.category);
          return focus ? [{ competency, focus }] : [];
        }),
    [competencies, skills],
  );

  if (competencies.length === 0) return null;

  const addToNextLesson = (categoryLabelText: string, focusLabel: string, zone: CompetencyZone) => {
    guardAction('Adding to the next lesson', () => {
      sessionStorage.setItem(
        'prefillWorksheet',
        JSON.stringify({
          topic: `${categoryLabelText} practice: ${focusLabel}`,
          goal: '',
          additionalInfo:
            zone === 'retention_alert'
              ? `Spaced review of ${focusLabel}: previously strong, estimated retention is fading.`
              : `Targeted practice for ${focusLabel}: current evidence shows a gap.`,
          grammarFocus: '',
        }),
      );
      sessionStorage.removeItem('prefillSuggestionId');
      sessionStorage.setItem('forceNewWorksheet', 'true');
      navigate('/');
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4" data-testid="competency-radar">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <RadarIcon className="h-4 w-4" aria-hidden="true" /> Competency radar
        </h3>
        {ZONE_ORDER.map((zone) =>
          counts[zone] > 0 ? (
            <Badge key={zone} variant={ZONE_BADGE_VARIANT[zone]} className="font-normal">
              {ZONE_LABELS[zone]}: {counts[zone]}
            </Badge>
          ) : null,
        )}
      </div>

      {radarRows.length >= 3 && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarRows}>
              <PolarGrid />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar
                name="Stored mastery"
                dataKey="raw"
                stroke="hsl(var(--muted-foreground))"
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.15}
              />
              <Radar
                name="Estimated retention"
                dataKey="effective"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {attention.length > 0 ? (
        <ul className="space-y-2" aria-label="Skills needing attention">
          {attention.map(({ competency, focus }) => (
            <li
              key={competency.category}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
            >
              {competency.zone === 'retention_alert' ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 break-words text-foreground">
                <span className="font-medium">{focus.label}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {ZONE_LABELS[competency.zone]} · retention {focus.effective_mastery}%
                  {focus.raw_mastery !== focus.effective_mastery ? ` (stored ${focus.raw_mastery}%)` : ''}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addToNextLesson(competency.label, focus.label, competency.zone)}
              >
                Add to next lesson <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No critical gaps or fading strengths right now.</p>
      )}
    </div>
  );
}

export default CompetencyRadarView;
