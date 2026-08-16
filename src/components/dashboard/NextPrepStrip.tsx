import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, UserPlus, ArrowRight } from 'lucide-react';

interface NextPrepStudent {
  id: string;
  name: string;
  english_level?: string | null;
  main_goal?: string | null;
}

interface NextPrepStripProps {
  students: NextPrepStudent[];
  onAddStudent: () => void;
}

/**
 * v6.9.92 P5 — presentation-only "what now" strip above the dashboard columns.
 * Uses the already fetched student list (sorted by updated_at desc) — no extra query.
 */
export const NextPrepStrip: React.FC<NextPrepStripProps> = ({ students, onAddStudent }) => {
  const navigate = useNavigate();
  const top = students.slice(0, 3);

  return (
    <section aria-label="Next prep" className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Start your next 1-Minute Prep
        </h2>
      </div>

      {top.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              Add your first student to unlock 1-Minute Prep.
            </p>
            <Button size="sm" onClick={onAddStudent}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add your first student
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((s) => (
            <Card key={s.id} className="min-w-0 transition-colors hover:border-primary/50">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{s.name}</span>
                    {s.english_level && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {s.english_level}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {s.main_goal || 'No main goal set yet'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-auto w-full"
                  onClick={() => navigate(`/student/${s.id}`)}
                  aria-label={`Start 1-Minute Prep for ${s.name}`}
                >
                  Start 1-Minute Prep
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};

export default NextPrepStrip;
