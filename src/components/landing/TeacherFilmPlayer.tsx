import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import teacherTourPoster from '@/assets/teacher-tour-poster.jpg.asset.json';
import { cn } from '@/lib/utils';

interface TeacherFilmPlayerProps {
  compact?: boolean;
}

const TeacherFilmPlayer: React.FC<TeacherFilmPlayerProps> = ({ compact = false }) => {
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="min-w-0">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-muted">
        {started ? (
          <>
            {!loaded && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 motion-safe:animate-spin" />Loading tour</div>}
            <iframe
              src="/embeds/teacher-film-v3.html?autoplay=1"
              title="Edooqoo 1-Minute Prep Interactive Tour"
              sandbox="allow-scripts"
              allow="fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              className={cn('absolute inset-0 h-full w-full border-0', !loaded && 'invisible')}
            />
          </>
        ) : (
          <>
            <img src={teacherTourPoster.url} alt="Example student lesson with goals, test evidence and an editable worksheet" width={1200} height={900} loading="lazy" className="h-full w-full object-contain" />
            <Button type="button" size="lg" aria-label="Play interactive teacher tour" onClick={() => setStarted(true)}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg">
              <Play className="h-5 w-5" />Play tour
            </Button>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
        <span>110-second tour · Illustrative student and results</span>
        {compact && <Button variant="link" size="sm" asChild className="h-auto px-0 py-0 text-xs">
          <Link to="/one-minute-prep#interactive-tour">Open full tour<ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </Button>}
      </div>
    </div>
  );
};

export default TeacherFilmPlayer;