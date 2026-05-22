/**
 * SkillsView — "Where they are" — current skill levels.
 * Compact: tight summary row, heat map open by default, notes collapsed.
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkillsOverviewPanel } from '@/components/dslm/SkillsOverviewPanel';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import { StudentKnowledgeEntryCard } from '@/components/student-knowledge/StudentKnowledgeEntryCard';
import { CollapsibleSection } from './CollapsibleSection';
import { BarChart3, Layers, StickyNote } from 'lucide-react';

interface SkillsViewProps {
  studentId: string;
  teacherId: string;
  englishLevel: string;
  totalWorksheetCount: number;
}

export const SkillsView: React.FC<SkillsViewProps> = ({
  studentId,
  teacherId,
  englishLevel,
  totalWorksheetCount,
}) => {
  const skillNotes = useStudentKnowledge({ studentId, teacherId });
  const skillAssessmentNotes = skillNotes.entries.filter(e => e.category === 'Skill Assessment');

  return (
    <div className="space-y-3">
      {/* Compact summary row */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Level:</span>
              <Badge variant="secondary">{englishLevel || 'N/A'}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Worksheets:</span>
              <span className="font-semibold">{totalWorksheetCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills Heat Map — open by default (radar + categories only) */}
      <CollapsibleSection id="skills-heatmap" title="Skills Heat Map" icon={BarChart3} defaultOpen>
        <SkillsOverviewPanel studentId={studentId} teacherId={teacherId} onlySection="heatmap" />
      </CollapsibleSection>

      {/* Micro Skills — collapsed, independent */}
      <CollapsibleSection id="skills-micro" title="Micro Skills" icon={Layers}>
        <SkillsOverviewPanel studentId={studentId} teacherId={teacherId} onlySection="micro" />
      </CollapsibleSection>

      {/* Skill Assessment Notes — collapsed */}
      <CollapsibleSection id="skills-notes" title="Skill Assessment Notes" icon={StickyNote} count={skillAssessmentNotes.length}>
        {skillAssessmentNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No skill assessment notes yet</p>
        ) : (
          <div className="space-y-2">
            {skillAssessmentNotes.map(entry => (
              <StudentKnowledgeEntryCard
                key={entry.id} entry={entry}
                onView={() => {}} onEdit={() => {}} onDelete={skillNotes.deleteEntry}
                onMarkOutdated={skillNotes.markAsOutdated}
                onMarkCurrent={skillNotes.markAsCurrent}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
};
