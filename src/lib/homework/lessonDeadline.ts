/**
 * Default homework deadline from the lesson calendar: shortly before the student's next booked
 * lesson, so the homework can be discussed in it. Without a suitable lesson the caller keeps
 * its usual default (about a week ahead).
 */
import { fromZonedTime } from 'date-fns-tz';

export interface BookedSlot {
  slot_date: string;   // yyyy-MM-dd, in the teacher's calendar time zone
  start_time: string;  // HH:mm[:ss]
}

/** The deadline is this long before the lesson starts. */
export const DEADLINE_BEFORE_LESSON_MS = 2 * 60 * 60 * 1000;
/** The student needs at least this long to do the homework, else the next lesson after it is used. */
export const MIN_WORK_WINDOW_MS = 4 * 60 * 60 * 1000;
/** Lessons further away than this are not a cadence signal. */
export const MAX_LOOKAHEAD_MS = 14 * 24 * 60 * 60 * 1000;

export interface LessonDeadline {
  deadline: Date;
  lessonAt: Date;
}

export function suggestDeadlineFromLessons(
  slots: readonly BookedSlot[],
  timeZone: string,
  now: Date = new Date(),
): LessonDeadline | null {
  let best: LessonDeadline | null = null;
  for (const slot of slots) {
    const time = slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time;
    let lessonAt: Date;
    try {
      lessonAt = fromZonedTime(`${slot.slot_date}T${time}`, timeZone);
    } catch {
      continue;
    }
    if (Number.isNaN(lessonAt.getTime())) continue;
    const deadline = new Date(lessonAt.getTime() - DEADLINE_BEFORE_LESSON_MS);
    const untilDeadline = deadline.getTime() - now.getTime();
    if (untilDeadline < MIN_WORK_WINDOW_MS || lessonAt.getTime() - now.getTime() > MAX_LOOKAHEAD_MS) continue;
    if (!best || lessonAt < best.lessonAt) best = { deadline, lessonAt };
  }
  return best;
}
