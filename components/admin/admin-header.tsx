import React from "react";

export function AdminHeader() {
  return (
    <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-lg text-slate-900 dark:text-white">
          Safety Admin
        </span>
      </div>
    </header>
  );
}
