import React from "react";

export default function AdminPage() {
  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Safety Training Admin Panel
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Create, edit, and publish courses, view worker progress, and manage reminders.
        </p>
      </div>
    </main>
  );
}
