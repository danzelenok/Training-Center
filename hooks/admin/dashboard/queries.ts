import { useQuery } from "@tanstack/react-query";
import { remindersExhaustedKeys, type RemindersExhaustedRow } from "./types";

async function fetchRemindersExhausted(): Promise<RemindersExhaustedRow[]> {
  const res = await fetch("/api/admin/dashboard/reminders-exhausted");
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error(data.error || "Failed to fetch overdue workers");
  return data;
}

export function useRemindersExhaustedQuery() {
  return useQuery({
    queryKey: remindersExhaustedKeys.all(),
    queryFn: fetchRemindersExhausted,
  });
}
