import React from 'react';
import { BookOpen, Coins, FileText, Target, Users, ClipboardList, Calendar } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

interface CompactStatsBarProps {
  tokenLeft: number;
  thisMonthCount: number;
  totalWorksheets: number;
  studentsCount: number;
  activeHomeworkCount: number;
  upcomingLessonsCount: number;
}

const CompactStatsBar: React.FC<CompactStatsBarProps> = ({
  tokenLeft, thisMonthCount, totalWorksheets, studentsCount,
  activeHomeworkCount, upcomingLessonsCount,
}) => {
  const isMobile = useIsMobile();

  const stats = [
    { label: 'Tokens', full: 'Tokens left', value: tokenLeft, Icon: Coins },
    { label: 'Month', full: 'Worksheets this month', value: thisMonthCount, Icon: FileText },
    { label: 'Total', full: 'All-time worksheets', value: totalWorksheets, Icon: Target },
    { label: 'Students', full: 'Active students', value: studentsCount, Icon: Users },
    { label: 'Homework', full: 'Active homework (not completed)', value: activeHomeworkCount, Icon: ClipboardList },
    { label: 'Lessons', full: 'Booked lessons in next 7 days', value: upcomingLessonsCount, Icon: Calendar },
  ];

  const HubInfo = (
    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 min-w-0 h-full">
      <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <span className="text-sm leading-snug">
        <span className="font-semibold text-foreground">Student Hub:</span>{' '}
        <span className="text-muted-foreground">
          <span className="lg:hidden">login at </span>
          <span className="hidden lg:inline">students log in with just their email at </span>
        </span>
        <a
          href="https://edooqoo.com/my"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          edooqoo.com/my
        </a>
        <span className="hidden lg:inline text-muted-foreground"> — no login needed. They access their worksheets, homework, flashcards & lessons.</span>
      </span>
    </div>
  );

  const StatPill = ({ label, full, value, Icon }: typeof stats[number]) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2.5 py-1 min-w-0">
            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-semibold tabular-nums">{value}</span>
            <span className="text-[11px] text-muted-foreground truncate">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom"><span className="text-xs">{full}</span></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (isMobile) {
    return (
      <div className="mb-4 space-y-2">
        {HubInfo}
        <div className="grid grid-cols-3 gap-1 border border-border rounded-md py-1">
          {stats.map(s => <StatPill key={s.label} {...s} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
      {HubInfo}
      <div className="flex items-center justify-between divide-x divide-border border border-border rounded-md bg-card overflow-x-auto">
        {stats.map(s => <StatPill key={s.label} {...s} />)}
      </div>
    </div>
  );
};

export default CompactStatsBar;