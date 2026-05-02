import React, { useMemo } from 'react';
import { CalendarSlot } from '@/hooks/useCalendarSlots';
import { format, parseISO } from 'date-fns';
import { Clock, User, FileText, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarScheduleViewProps {
  slots: CalendarSlot[];
  studentMap: Record<string, string>;
  onSlotClick: (slot: CalendarSlot) => void;
}

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  booked: 'bg-blue-500',
  completed: 'bg-muted-foreground',
  cancelled: 'bg-red-400',
  no_show: 'bg-red-600',
};

export function CalendarScheduleView({ slots, studentMap, onSlotClick }: CalendarScheduleViewProps) {
  // Group by day, only show booked/completed/available (skip cancelled)
  const grouped = useMemo(() => {
    const filtered = slots
      .filter(s => s.status !== 'cancelled')
      .sort((a, b) => a.slot_date.localeCompare(b.slot_date) || a.start_time.localeCompare(b.start_time));

    const groups: Record<string, CalendarSlot[]> = {};
    for (const slot of filtered) {
      if (!groups[slot.slot_date]) groups[slot.slot_date] = [];
      groups[slot.slot_date].push(slot);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  if (grouped.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-background p-8 text-center text-muted-foreground">
        No scheduled lessons in this period.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-background divide-y divide-border">
      {grouped.map(([dateStr, daySlots]) => {
        const date = parseISO(dateStr);
        const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

        return (
          <div key={dateStr} className="flex">
            {/* Date column */}
            <div className={cn('w-28 flex-shrink-0 p-3 border-r border-border', isToday && 'bg-primary/5')}>
              <div className="text-xs text-muted-foreground uppercase">{format(date, 'EEE')}</div>
              <div className={cn('text-lg font-semibold', isToday && 'text-primary')}>{format(date, 'MMM d')}</div>
              <div className="text-xs text-muted-foreground">{format(date, 'yyyy')}</div>
            </div>

            {/* Slots */}
            <div className="flex-1 divide-y divide-border/50">
              {daySlots.map(slot => {
                const isPending = slot.status === 'booked' && !slot.confirmed_at;
                const studentN = slot.student_id ? studentMap[slot.student_id] : null;

                return (
                  <button
                    key={slot.id}
                    onClick={() => onSlotClick(slot)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isPending ? 'bg-amber-500' : STATUS_DOT[slot.status] || 'bg-muted-foreground')} />
                    <div className="flex items-center gap-1.5 text-sm font-medium min-w-[100px]">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {studentN ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate font-medium">{studentN}</span>
                          {isPending && <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">(pending)</span>}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">{slot.title || 'Available slot'}</span>
                      )}
                    </div>
                    {slot.worksheet_id && <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
