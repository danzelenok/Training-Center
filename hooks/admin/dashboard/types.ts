export interface RemindersExhaustedRow {
  assignmentId: string;
  workerId: string;
  workerName: string;
  courseName: string;
  dueDate: string;
}

export const remindersExhaustedKeys = {
  all: () => ["admin-dashboard-reminders-exhausted"] as const,
};
