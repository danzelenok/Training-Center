import { addBusinessDays } from "date-fns";

/** Assignment due date = assignedAt + 5 business days (Mon-Fri only, no holiday calendar). */
export function computeAssignmentDueDate(assignedAt: Date): Date {
  return addBusinessDays(assignedAt, 5);
}

export type ReminderKind = "before" | "after";

export interface ScheduledReminder {
  kind: ReminderKind;
  occurrenceIndex: number; // 1-based, within its kind
  scheduledAt: Date;
}

/**
 * The full, deterministic list of reminder moments for one assignment given
 * its assignedAt/dueDate and the org's current reminder settings. Pure —
 * does not consult the DB or clock.
 *
 * "before" occurrence i (1..remindersBeforeCount) is spaced evenly, strictly
 * between assignedAt and dueDate: assignedAt + (i / (remindersBeforeCount + 1)) * (dueDate - assignedAt).
 * "after" occurrence i (1..remindersAfterCount) fires on dueDate + (i - 1) days
 * (the first "after" reminder lands exactly on the due date, then daily).
 */
export function computeReminderSchedule(
  assignedAt: Date,
  dueDate: Date,
  remindersBeforeCount: number,
  remindersAfterCount: number
): ScheduledReminder[] {
  const schedule: ScheduledReminder[] = [];
  const windowMs = dueDate.getTime() - assignedAt.getTime();

  for (let i = 1; i <= remindersBeforeCount; i++) {
    const fraction = i / (remindersBeforeCount + 1);
    schedule.push({
      kind: "before",
      occurrenceIndex: i,
      scheduledAt: new Date(assignedAt.getTime() + fraction * windowMs),
    });
  }

  for (let i = 1; i <= remindersAfterCount; i++) {
    schedule.push({
      kind: "after",
      occurrenceIndex: i,
      scheduledAt: new Date(dueDate.getTime() + (i - 1) * 24 * 60 * 60 * 1000),
    });
  }

  return schedule;
}
