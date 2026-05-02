import React from 'react';
import { cn } from '@/lib/utils';
import { CalendarSlot } from '@/hooks/useCalendarSlots';
import { FileText, Clock, User, Check, Lock, Trash2 } from 'lucide-react';

interface CalendarSlotCardProps {
  slot: CalendarSlot;
  studentName?: string;
  onClick: (slot: CalendarSlot) => void;
  compact?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:border-green-700 dark:text-green-300',
  booked: 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300',
  completed: 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-50 border-red-200 text-red-400 line-through opacity-60 dark:bg-red-900/20 dark:border-red-800',
  no_show: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-300',
  deleted: 'bg-muted/50 border-border/50 text-muted-foreground/50 line-through opacity-40',
  needs_review: 'bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-300',
};

const STATUS_BADGES: Record<string, { letter: string; color: string }> = {
  available: { letter: 'A', color: 'bg-green-500 text-white' },
  booked: { letter: 'B', color: 'bg-blue-500 text-white' },
  pending: { letter: 'P', color: 'bg-amber-500 text-white' },
  completed: { letter: '✓', color: 'bg-emerald-500 text-white' },
  no_show: { letter: 'NS', color: 'bg-red-500 text-white' },
  block: { letter: 'B', color: 'bg-gray-500 text-white' },
  deleted: { letter: 'D', color: 'bg-muted-foreground/50 text-white' },
  needs_review: { letter: '?', color: 'bg-purple-500 text-white' },
};

export const CalendarSlotCard = React.memo(function CalendarSlotCard({ slot, studentName, onClick, compact, isSelected, selectionMode }: CalendarSlotCardProps) {
  const isBlock = (slot as any).slot_type === 'block';
  const isPending = slot.status === 'booked' && !slot.confirmed_at;
  const isDeleted = slot.status === ('deleted' as any);
  const isNeedsReview = (slot.status as string) === 'needs_review';
  
  let style: string;
  if (isBlock) {
    style = 'bg-gray-200 border-gray-400 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400';
  } else if (isDeleted) {
    style = STATUS_STYLES.deleted;
  } else if (isNeedsReview) {
    style = STATUS_STYLES.needs_review;
  } else if (isPending) {
    style = 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300';
  } else {
    style = STATUS_STYLES[slot.status] || STATUS_STYLES.available;
  }

  const startHH = slot.start_time.slice(0, 5);
  const endHH = slot.end_time.slice(0, 5);

  // Badge R: rescheduled slot
  const isRescheduled = slot.status === 'available' && slot.cancelled_by === 'system' && slot.cancellation_reason?.includes('Rescheduled');
  // Badge C: available slot with cancellation history (but not rescheduled)
  const showBadgeC = slot.status === 'available' && slot.cancelled_at && slot.cancelled_by && !isRescheduled;

  // Status badge letter
  const badgeKey = isBlock ? 'block' : isDeleted ? 'deleted' : isNeedsReview ? 'needs_review' : isPending ? 'pending' : slot.status;
  const statusBadge = STATUS_BADGES[badgeKey] || STATUS_BADGES.available;

  return (
    <button
      onClick={() => onClick(slot)}
      className={cn(
        'w-full h-full text-left rounded-md border px-1.5 py-0.5 text-[11px] transition-all cursor-pointer truncate relative',
        'hover:shadow-md hover:scale-[1.01]',
        style,
        isSelected && 'ring-2 ring-primary bg-primary/20'
      )}
    >
      {/* Badge R — rescheduled */}
      {isRescheduled ? (
        <div className={cn(
          'absolute top-0 left-0 min-w-[14px] h-[14px] rounded-br text-[8px] font-bold flex items-center justify-center z-10 px-0.5',
          'bg-indigo-400 text-indigo-900'
        )}>
          R
        </div>
      ) : showBadgeC ? (
        <div className={cn(
          'absolute top-0 left-0 min-w-[14px] h-[14px] rounded-br text-[8px] font-bold flex items-center justify-center z-10 px-0.5',
          slot.cancelled_by === 'student' ? 'bg-amber-400 text-amber-900' : 'bg-blue-400 text-blue-900'
        )}>
          {slot.cancelled_by === 'student' ? 'SC' : 'TC'}
        </div>
      ) : (
        <div className={cn(
          'absolute top-0 left-0 min-w-[14px] h-[14px] rounded-br text-[8px] font-bold flex items-center justify-center z-10 px-0.5',
          statusBadge.color
        )}>
          {statusBadge.letter}
        </div>
      )}

      {/* Discount badge */}
      {(slot as any).discount_percent > 0 && !showBadgeC && (
        <span className="absolute top-0 right-0 text-[8px] font-bold text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400 rounded-bl px-0.5 z-10">
          -{(slot as any).discount_percent}%
        </span>
      )}

      {/* Selection checkbox overlay */}
      {selectionMode && !slot.student_id && (
        <div className="absolute top-0.5 right-0.5 z-10">
          <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center',
            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50 bg-background'
          )}>
            {isSelected && <Check className="h-3 w-3" />}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 font-medium leading-tight pl-3">
        {isBlock ? <Lock className="h-3 w-3 flex-shrink-0" /> : isDeleted ? <Trash2 className="h-3 w-3 flex-shrink-0" /> : <Clock className="h-3 w-3 flex-shrink-0" />}
        <span className="truncate">{startHH}–{endHH}</span>
        {slot.worksheet_id && <FileText className="h-3 w-3 flex-shrink-0 ml-auto" />}
      </div>
      {!compact && isBlock && slot.notes && (
        <div className="truncate mt-0.5 text-[10px] opacity-80 pl-3">{slot.notes}</div>
      )}
      {!compact && !isBlock && studentName && (
        <div className="flex items-center gap-0.5 truncate mt-0.5 text-[10px] opacity-80 pl-3">
          <User className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">{studentName}</span>
        </div>
      )}
      {!compact && !isBlock && !studentName && slot.title && (
        <div className="truncate mt-0.5 text-[10px] opacity-80 pl-3">{slot.title}</div>
      )}
    </button>
  );
});
