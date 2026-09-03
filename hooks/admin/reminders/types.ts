export interface ReminderSettings {
  remindersBeforeCount: number;
  remindersAfterCount: number;
}

export const reminderSettingsKeys = {
  all: () => ["admin-reminder-settings"] as const,
};
