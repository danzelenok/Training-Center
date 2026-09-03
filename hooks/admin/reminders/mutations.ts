import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderSettingsKeys, type ReminderSettings } from "./types";

export function useUpdateReminderSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: ReminderSettings) => {
      const res = await fetch("/api/admin/settings/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update reminder settings");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderSettingsKeys.all() });
      toast.success("Reminder settings saved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save reminder settings");
    },
  });
}
