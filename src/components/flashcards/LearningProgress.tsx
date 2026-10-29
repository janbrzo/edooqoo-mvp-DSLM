import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LearningSessionStats } from '@/types/flashcards';

interface LearningProgressProps {
  current: number;
  total: number;
  stats: LearningSessionStats;
}

export function LearningProgress({ current, total, stats }: LearningProgressProps) {
  const progress = total > 0 ? (Math.min(current, total) / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Card {current} of {total}
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">
            ✓ {stats.correctAnswers}
          </Badge>
          <Badge variant="outline">
            ✗ {stats.incorrectAnswers}
          </Badge>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
