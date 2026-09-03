"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRemindersExhaustedQuery } from "@/hooks/admin/dashboard/queries";

export function RemindersExhaustedWidget() {
  const query = useRemindersExhaustedQuery();
  const rows = query.data ?? [];
  const loading = query.isLoading;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
      <div className="flex items-start gap-3 px-6 py-5 border-b border-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#1B2A6B] dark:text-[#C8D400]">Needs Manual Follow-Up</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overdue workers who have already received every configured reminder — they won&apos;t be reminded again automatically.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#C8D400]" />
            <p className="text-sm font-medium">Checking...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">Nothing needs your attention right now.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-3">Worker</th>
                <th className="px-6 py-3">Course</th>
                <th className="px-6 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.assignmentId}>
                  <td className="px-6 py-3 text-sm font-semibold text-foreground">{row.workerName}</td>
                  <td className="px-6 py-3 text-sm text-muted-foreground">{row.courseName}</td>
                  <td className="px-6 py-3 text-xs text-red-500 font-medium">
                    {format(new Date(row.dueDate), "yyyy-MM-dd")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
