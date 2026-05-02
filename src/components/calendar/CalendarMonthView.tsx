import React from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isToday, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarSlot } from '@/hooks/useCalendarSlots';
import { Plus } from 'lucide-react';

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-400',
  booked: 'bg-blue-400',
  completed: 'bg-muted-foreground',
  cancelled: 'bg-red-300',
  no_show: 'bg-red-500',
};

interface CalendarMonthViewProps {
  currentDate: Date;
  slots: CalendarSlot[];
  studentMap: Record<string, string>;
  onDayClick: (date: Date) => void;
  onAddSlot: (date: Date) => void;
  onSlotClick: (slot: CalendarSlot) => void;
}

export function CalendarMonthView({ currentDate, slots, studentMap, onDayClick, onAddSlot, onSlotClick }: CalendarMonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build grid days
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  // Group slots by date
  const slotsByDate: Record<string, CalendarSlot[]> = {};
  slots.forEach(s => {
    if (!slotsByDate[s.slot_date]) slotsByDate[s.slot_date] = [];
    slotsByDate[s.slot_date].push(s);
  });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center py-2 text-xs font-medium text-muted-foreground border-r last:border-r-0 border-border">
            {day}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0 border-border">
          {week.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySlots = slotsByDate[dateStr] || [];
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const maxVisible = 3;
            const visibleSlots = daySlots.slice(0, maxVisible);
            const moreCount = daySlots.length - maxVisible;

            return (
              <div
                key={dateStr}
                className={cn(
                  'min-h-[100px] border-r last:border-r-0 border-border p-1 cursor-pointer hover:bg-muted/30 transition-colors relative group',
                  !inMonth && 'opacity-40',
                  today && 'bg-primary/5'
                )}
                onClick={() => onDayClick(day)}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    today && 'bg-primary text-primary-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); onAddSlot(day); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-muted"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>

                {/* Slot indicators */}
                <div className="space-y-0.5">
                  {visibleSlots.map(slot => {
                    const isPending = slot.status === 'booked' && !slot.confirmed_at;
                    const dotColor = isPending ? 'bg-amber-400' : (STATUS_DOT[slot.status] || STATUS_DOT.available);
                    const studentName = slot.student_id ? studentMap[slot.student_id] : null;
                    return (
                      <button
                        key={slot.id}
                        onClick={e => { e.stopPropagation(); onSlotClick(slot); }}
                        className="w-full flex items-center gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-muted/50 transition-colors truncate"
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
                        <span className="truncate">
                          {slot.start_time.slice(0, 5)} {studentName || slot.title || ''}
                        </span>
                      </button>
                    );
                  })}
                  {moreCount > 0 && (
                    <span className="text-[10px] text-muted-foreground pl-1">+{moreCount} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
