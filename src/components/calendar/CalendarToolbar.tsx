import React from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronLeft, ChevronRight, Plus, Settings, Share2, History } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ViewMode } from '@/hooks/useCalendarSlots';

interface CalendarToolbarProps {
  currentDate: Date;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (dir: 'prev' | 'next' | 'today') => void;
  onAddSlot: () => void;
  onSettings: () => void;
  onShare?: () => void;
  onLogs?: () => void;
}

function getDateLabel(currentDate: Date, viewMode: ViewMode): string {
  if (viewMode === 'day') {
    return format(currentDate, 'EEEE, MMM d, yyyy');
  } else if (viewMode === 'week') {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const we = endOfWeek(currentDate, { weekStartsOn: 1 });
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
  } else if (viewMode === 'schedule') {
    return `Schedule from ${format(currentDate, 'MMM d, yyyy')}`;
  } else {
    return format(currentDate, 'MMMM yyyy');
  }
}

export function CalendarToolbar({
  currentDate, viewMode, onViewModeChange, onNavigate,
  onAddSlot, onSettings, onShare, onLogs,
}: CalendarToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate('prev')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => onNavigate('today')}>
          Today
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate('next')}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium ml-2 whitespace-nowrap">
          {getDateLabel(currentDate, viewMode)}
        </span>
      </div>

      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(v) => { if (v) onViewModeChange(v as ViewMode); }}
        className="border rounded-lg"
      >
        <ToggleGroupItem value="day" className="text-xs px-3 h-8">Day</ToggleGroupItem>
        <ToggleGroupItem value="week" className="text-xs px-3 h-8">Week</ToggleGroupItem>
        <ToggleGroupItem value="month" className="text-xs px-3 h-8">Month</ToggleGroupItem>
        <ToggleGroupItem value="schedule" className="text-xs px-3 h-8">Schedule</ToggleGroupItem>
      </ToggleGroup>

      <div className="flex items-center gap-1.5">
        {onLogs && (
          <Button variant="outline" size="sm" className="h-8" onClick={onLogs}>
            <History className="h-3.5 w-3.5 mr-1" /> Logs
          </Button>
        )}
        {onShare && (
          <Button variant="outline" size="sm" className="h-8" onClick={onShare}>
            <Share2 className="h-3.5 w-3.5 mr-1" /> Share
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8" onClick={onSettings}>
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" className="h-8" onClick={onAddSlot}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
