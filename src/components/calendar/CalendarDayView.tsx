import React, { useState, useEffect } from 'react';
import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarSlot } from '@/hooks/useCalendarSlots';
import { CalendarSlotCard } from './CalendarSlotCard';
import { detectOverlaps } from '@/utils/calendarOverlapUtils';

const ROW_HEIGHT = 22;

function getSlotPosition(slot: CalendarSlot, startHour: number) {
  const [sh, sm] = slot.start_time.split(':').map(Number);
  const [eh, em] = slot.end_time.split(':').map(Number);
  const startMin = (sh - startHour) * 60 + sm;
  const endMin = (eh - startHour) * 60 + em;
  return {
    top: (startMin / 30) * ROW_HEIGHT,
    height: Math.max(((endMin - startMin) / 30) * ROW_HEIGHT, ROW_HEIGHT / 2),
  };
}

interface CalendarDayViewProps {
  date: Date;
  slots: CalendarSlot[];
  studentMap: Record<string, string>;
  onSlotClick: (slot: CalendarSlot) => void;
  onAddSlot: (date: Date, startTime?: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  startHour?: number;
  endHour?: number;
}

export const CalendarDayView = React.memo(function CalendarDayView({ date, slots, studentMap, onSlotClick, onAddSlot, selectionMode, selectedIds, startHour: START_HOUR = 7, endHour: END_HOUR = 22 }: CalendarDayViewProps) {
  const TOTAL_HALF_HOURS = (END_HOUR - START_HOUR) * 2;
  const activeSlots = slots.filter(s => s.status !== 'cancelled');
  const positioned = detectOverlaps(activeSlots);

  const [nowMinute, setNowMinute] = useState(() => {
    const n = new Date();
    return (n.getHours() - START_HOUR) * 60 + n.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const n = new Date();
      setNowMinute((n.getHours() - START_HOUR) * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, [START_HOUR]);

  const nowTop = (nowMinute / 30) * ROW_HEIGHT;
  const showNowLine = isToday(date) && nowMinute >= 0 && nowMinute <= (END_HOUR - START_HOUR) * 60;

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const halfHourIdx = Math.floor(y / ROW_HEIGHT);
    const hour = START_HOUR + Math.floor(halfHourIdx / 2);
    const min = (halfHourIdx % 2) * 30;
    onAddSlot(date, `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className={cn('text-center py-3 border-b border-border', isToday(date) && 'bg-primary/5')}>
        <div className="text-xs text-muted-foreground">{format(date, 'EEEE')}</div>
        <div className={cn('text-lg font-semibold', isToday(date) && 'text-primary')}>{format(date, 'MMMM d, yyyy')}</div>
      </div>

      <div className="flex overflow-y-auto" style={{ maxHeight: 600 }}>
        <div className="w-16 flex-shrink-0 border-r border-border">
          {Array.from({ length: TOTAL_HALF_HOURS }, (_, i) => {
            const hour = START_HOUR + Math.floor(i / 2);
            const isFullHour = i % 2 === 0;
            return (
              <div key={i} className={cn('border-b flex items-start justify-end pr-2 pt-0.5', isFullHour ? 'border-border/15' : 'border-border/80')} style={{ height: ROW_HEIGHT }}>
                {isFullHour && <span className="text-[10px] text-muted-foreground leading-none">{String(hour).padStart(2, '0')}:00</span>}
              </div>
            );
          })}
        </div>

        <div className="flex-1 relative cursor-pointer" onClick={handleGridClick} style={{ height: TOTAL_HALF_HOURS * ROW_HEIGHT }}>
          {Array.from({ length: TOTAL_HALF_HOURS }, (_, i) => (
            <div key={i} className={cn('absolute w-full border-b', i % 2 === 0 ? 'border-border/15' : 'border-border/80')} style={{ top: i * ROW_HEIGHT + ROW_HEIGHT - 1 }} />
          ))}

          {showNowLine && (
            <div className="absolute w-full z-20 flex items-center" style={{ top: nowTop }}>
              <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1" />
              <div className="flex-1 h-0.5 bg-destructive" />
            </div>
          )}

          {positioned.map(({ slot, columnIndex, columnCount, isOverlapping }) => {
            const pos = getSlotPosition(slot, START_HOUR);
            const widthPercent = 100 / columnCount;
            const leftPercent = columnIndex * widthPercent;
            return (
              <div
                key={slot.id}
                className={cn('absolute z-10', isOverlapping && 'ring-2 ring-destructive rounded-md')}
                style={{
                  top: pos.top,
                  height: pos.height,
                  left: `calc(${leftPercent}% + 4px)`,
                  width: `calc(${widthPercent}% - 8px)`,
                }}
                onClick={e => e.stopPropagation()}
              >
                <CalendarSlotCard slot={slot} studentName={slot.student_id ? studentMap[slot.student_id] : undefined} onClick={onSlotClick} compact={pos.height < ROW_HEIGHT} selectionMode={selectionMode} isSelected={selectedIds?.has(slot.id)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
