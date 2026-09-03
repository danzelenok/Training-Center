"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReminderSettingsQuery } from "@/hooks/admin/reminders/queries";
import { useUpdateReminderSettingsMutation } from "@/hooks/admin/reminders/mutations";
import { computeReminderSchedule, computeAssignmentDueDate } from "@/lib/dates";
import type { ReminderSettings } from "@/hooks/admin/reminders/types";

function daysFromNow(date: Date, from: Date): number {
  return Math.round((date.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function SchedulePreview({ remindersBeforeCount, remindersAfterCount }: { remindersBeforeCount: number; remindersAfterCount: number }) {
  const now = new Date();
  const dueDate = computeAssignmentDueDate(now);
  const schedule = computeReminderSchedule(now, dueDate, remindersBeforeCount, remindersAfterCount);

  if (schedule.length === 0) {
    return <p className="text-xs text-muted-foreground">No reminders will be sent with these settings.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {schedule.map((occ) => (
        <span
          key={`${occ.kind}-${occ.occurrenceIndex}`}
          className="text-xs font-medium rounded-lg px-2.5 py-1 bg-background border border-border"
        >
          Day {daysFromNow(occ.scheduledAt, now)}
          {occ.scheduledAt.getTime() === dueDate.getTime() ? " (due)" : ""}
        </span>
      ))}
    </div>
  );
}

// Only mounted once query data has loaded (see the parent's isLoading/isError
// gating below), so local state can be initialized straight from `initial`
// without an effect syncing props into state after the fact.
function ReminderSettingsForm({ initial }: { initial: ReminderSettings }) {
  const updateSettings = useUpdateReminderSettingsMutation();
  const [remindersBeforeCount, setRemindersBeforeCount] = useState(initial.remindersBeforeCount);
  const [remindersAfterCount, setRemindersAfterCount] = useState(initial.remindersAfterCount);

  const isValid = Number.isInteger(remindersBeforeCount) && remindersBeforeCount >= 0
    && Number.isInteger(remindersAfterCount) && remindersAfterCount >= 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5 max-w-xl">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
          Reminders before deadline
        </label>
        <Input
          type="number"
          min={0}
          value={remindersBeforeCount}
          onChange={(e) => setRemindersBeforeCount(Number(e.target.value))}
          className="w-32 h-10"
        />
        <p className="text-xs text-muted-foreground">
          Spread evenly across the 5-business-day assignment window.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
          Reminders after deadline
        </label>
        <Input
          type="number"
          min={0}
          value={remindersAfterCount}
          onChange={(e) => setRemindersAfterCount(Number(e.target.value))}
          className="w-32 h-10"
        />
        <p className="text-xs text-muted-foreground">
          Sent daily starting the day the deadline passes. Once all are sent, reminders stop for that assignment.
        </p>
      </div>

      {isValid && (
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
            Preview
          </label>
          <SchedulePreview remindersBeforeCount={remindersBeforeCount} remindersAfterCount={remindersAfterCount} />
        </div>
      )}

      <div className="pt-2">
        <Button
          disabled={!isValid || updateSettings.isPending}
          onClick={() => updateSettings.mutate({ remindersBeforeCount, remindersAfterCount })}
          className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4 rounded-xl"
        >
          {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

export default function ReminderSettingsPage() {
  const settingsQuery = useReminderSettingsQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1B2A6B] dark:text-[#C8D400]">Reminders</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configure how many Telegram reminders workers get before and after a training deadline.
        </p>
      </div>

      {settingsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : settingsQuery.isError || !settingsQuery.data ? (
        <p className="text-sm text-red-500">Failed to load reminder settings.</p>
      ) : (
        <ReminderSettingsForm initial={settingsQuery.data} />
      )}
    </div>
  );
}
