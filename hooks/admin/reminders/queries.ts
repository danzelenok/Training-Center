import { useQuery } from "@tanstack/react-query";
import { reminderSettingsKeys, type ReminderSettings } from "./types";

async function fetchReminderSettings(): Promise<ReminderSettings> {
  const res = await fetch("/api/admin/settings/reminders");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch reminder settings");
  return data;
}

export function useReminderSettingsQuery() {
  return useQuery({
    queryKey: reminderSettingsKeys.all(),
    queryFn: fetchReminderSettings,
  });
}
