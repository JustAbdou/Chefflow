/**
 * Helpers for Cleaning Checklist: weekday scheduling and daily completion logs.
 * Weekday names match JavaScript's toLocaleDateString('en-US', { weekday: 'long' }).
 */

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** Full weekday name in local timezone, e.g. "Tuesday" */
export function getTodayWeekdayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

/** Weekday name for a given Date (local), e.g. "Monday" */
export function getWeekdayNameForDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/** Calendar date key in local timezone YYYY-MM-DD */
export function getLocalDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Firestore log document id: one log per task per calendar day */
export function cleaningLogDocId(taskId, dateKey) {
  return `${dateKey}_${taskId}`;
}

/** Tasks whose daysOfWeek includes the given weekday (case-normalized) */
export function filterTasksForWeekday(tasks, weekdayName) {
  const w = weekdayName.trim();
  return tasks.filter((t) => {
    if (t.active === false || t.isArchived === true) return false;
    const days = Array.isArray(t.daysOfWeek) ? t.daysOfWeek : [];
    return days.some((d) => String(d).trim() === w);
  });
}

export function isTaskCompletedForDate(logsByTaskId, taskId) {
  const log = logsByTaskId[taskId];
  return !!(log && log.completed === true);
}
