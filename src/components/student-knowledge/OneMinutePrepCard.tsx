import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Heart, AlertCircle, Lightbulb } from 'lucide-react';
import { useOneMinutePrep } from '@/hooks/useOneMinutePrep';
import { Skeleton } from '@/components/ui/skeleton';

interface OneMinutePrepCardProps {
  studentId: string;
  teacherId: string;
  studentName: string;
}

/**
 * v6.9.8 — Visible "Quick Prep" digest card on Student Overview.
 * Shows the 3 most actionable signals per bucket so the teacher knows
 * exactly what to focus on next lesson.
 */
export const OneMinutePrepCard = ({ studentId, teacherId, studentName }: OneMinutePrepCardProps) => {
  const { data, isLoading } = useOneMinutePrep(studentId, teacherId);

  const empty =
    !isLoading &&
    (!data ||
      (data.personalHooks.length === 0 &&
        data.topWeaknesses.length === 0 &&
        data.lessonIdeas.length === 0));

  return (
    <Card className="mb-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Quick Prep — 1 minute for {studentName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
        {empty && (
          <p className="text-muted-foreground text-xs">
            Add a few notes about {studentName} (interests, recent mistakes, lesson ideas) to power Quick Prep.
          </p>
        )}
        {!isLoading && data && (
          <>
            <Section
              icon={<Heart className="h-3.5 w-3.5 text-rose-500" />}
              label="Personal hooks"
              entries={data.personalHooks.map((e) => e.content)}
            />
            <Section
              icon={<AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
              label="Focus on"
              entries={data.topWeaknesses.map((e) => {
                const ns = (e.metadata as any)?.nano_skill;
                return ns ? `${ns} — ${e.content}` : e.content;
              })}
            />
            <Section
              icon={<Lightbulb className="h-3.5 w-3.5 text-yellow-500" />}
              label="Lesson ideas"
              entries={data.lessonIdeas.map((e) => e.content)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Section = ({
  icon,
  label,
  entries,
}: { icon: React.ReactNode; label: string; entries: string[] }) => {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <Badge variant="secondary" className="h-4 px-1 text-[10px]">{entries.length}</Badge>
      </div>
      <ul className="ml-5 list-disc space-y-0.5 text-foreground/90">
        {entries.map((e, i) => (
          <li key={i} className="line-clamp-2">{e}</li>
        ))}
      </ul>
    </div>
  );
};