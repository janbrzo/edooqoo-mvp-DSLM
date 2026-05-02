import { Skeleton } from '@/components/ui/skeleton';

export const SectionSkeleton: React.FC = () => (
  <div className="space-y-3">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-16 w-2/3" />
  </div>
);
