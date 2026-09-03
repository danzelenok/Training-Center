"use client";

import { RemindersExhaustedWidget } from "@/components/admin/dashboard/RemindersExhaustedWidget";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1B2A6B] dark:text-[#C8D400]">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Overview of training compliance across your organization.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RemindersExhaustedWidget />
      </div>
    </div>
  );
}
