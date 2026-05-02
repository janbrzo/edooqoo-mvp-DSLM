import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Get the student's local timezone from the browser.
 */
export function getStudentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Convert slot times from teacher timezone to student timezone.
 * Returns both teacher and student local times as HH:MM strings,
 * plus potentially a different date for the student.
 */
export function toStudentLocalTimeRange(
  slotDate: string,
  startTime: string,
  endTime: string,
  teacherTz: string,
  studentTz: string
): {
  studentStartHHMM: string;
  studentEndHHMM: string;
  studentDate: string;
  teacherStartHHMM: string;
  teacherEndHHMM: string;
  isSameTimezone: boolean;
} {
  const teacherStart = `${slotDate}T${startTime.slice(0, 5)}:00`;
  const teacherEnd = `${slotDate}T${endTime.slice(0, 5)}:00`;

  // Convert teacher local time to UTC instant
  const startUtc = fromZonedTime(teacherStart, teacherTz);
  const endUtc = fromZonedTime(teacherEnd, teacherTz);

  // Format in student timezone
  const studentStartHHMM = formatInTimeZone(startUtc, studentTz, 'HH:mm');
  const studentEndHHMM = formatInTimeZone(endUtc, studentTz, 'HH:mm');
  const studentDate = formatInTimeZone(startUtc, studentTz, 'yyyy-MM-dd');

  const isSameTimezone = teacherTz === studentTz;

  return {
    studentStartHHMM,
    studentEndHHMM,
    studentDate,
    teacherStartHHMM: startTime.slice(0, 5),
    teacherEndHHMM: endTime.slice(0, 5),
    isSameTimezone,
  };
}

/**
 * Convert a slot date+time in teacher's timezone to a UTC Date instant.
 * Used for cancellation window calculations.
 */
export function toUtcInstant(slotDate: string, startTime: string, teacherTz: string): Date {
  const localStr = `${slotDate}T${startTime.slice(0, 5)}:00`;
  return fromZonedTime(localStr, teacherTz);
}
