"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Clock, ChevronDown, ChevronUp, Wrench, X } from "lucide-react";
import { env } from "@/env";

type ProgressStatus = "not_started" | "in_progress" | "completed";

interface Course {
  id: string;
  title: string;
  description: string | null;
  progressStatus: ProgressStatus;
  currentSlideIndex: number;
}

function getInitData(): string {
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  return tg?.initData || (process.env.NODE_ENV === "development" ? "mock-dev-data" : "");
}

function StatusBadge({ status }: { status: ProgressStatus }) {
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2.5 py-0.5">
        <Clock className="h-3 w-3" /> In Progress
      </span>
    );
  }
  return (
    <span className="text-[11px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
      New
    </span>
  );
}

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const isCompleted = course.progressStatus === "completed";
  const isInProgress = course.progressStatus === "in_progress";

  return (
    <li
      className={`border rounded-2xl p-4 flex flex-col gap-3 transition-colors ${
        isCompleted
          ? "bg-emerald-950/20 border-emerald-800/40"
          : isInProgress
          ? "bg-slate-900 border-yellow-700/30"
          : "bg-slate-900 border-sky-800/40"
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-white leading-snug flex-1">
            {course.title}
          </h2>
          <StatusBadge status={course.progressStatus} />
        </div>
        {course.description && (
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
            {course.description}
          </p>
        )}
      </div>

      <button
        onClick={onClick}
        className={`w-full text-sm font-semibold rounded-xl py-2.5 transition-colors ${
          isCompleted
            ? "bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200"
            : isInProgress
            ? "bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-slate-950"
            : "bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white"
        }`}
      >
        {isCompleted ? "Review Again" : isInProgress ? "Continue" : "Start Learning"}
      </button>
    </li>
  );
}

// Only shown to a telegram_id that ToolTrace's own backend confirms is an
// active field_worker there (spec: independent backends, each checks its
// own access — see app/api/mini-app/inventory-eligibility/route.ts). Anyone
// else never sees this screen at all and goes straight into Training below,
// exactly like before this chooser existed.
function AppChooser({ onOpenTraining }: { onOpenTraining: () => void }) {
  const openInventory = () => {
    const inventoryUrl = env.NEXT_PUBLIC_INVENTORY_APP_URL;
    if (!inventoryUrl) return;
    const initData = getInitData();
    window.location.href = `${inventoryUrl}/field?tid=${encodeURIComponent(initData)}`;
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 bg-slate-950">
      <p className="text-sm text-slate-400 mb-1">What do you need?</p>
      <button
        onClick={onOpenTraining}
        className="w-full max-w-xs flex items-center gap-3 bg-slate-900 border border-sky-800/40 rounded-2xl p-4 text-left active:bg-slate-800 transition-colors"
      >
        <span className="flex-none w-11 h-11 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
          <BookOpen className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-base font-semibold text-white">Safety Training</span>
          <span className="block text-xs text-slate-400 mt-0.5">Your assigned courses</span>
        </span>
      </button>
      <button
        onClick={openInventory}
        className="w-full max-w-xs flex items-center gap-3 bg-slate-900 border border-orange-800/40 rounded-2xl p-4 text-left active:bg-slate-800 transition-colors"
      >
        <span className="flex-none w-11 h-11 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
          <Wrench className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-base font-semibold text-white">Tool Inventory</span>
          <span className="block text-xs text-slate-400 mt-0.5">Report, request, transfer tools</span>
        </span>
      </button>
    </main>
  );
}

export default function MiniAppPage() {
  const router = useRouter();
  // "checking" briefly gates the very first render only; the eligibility
  // check and the course fetch below both start immediately in parallel so
  // the common case (not Inventory-eligible) never waits on the extra
  // network round trip before Training starts loading.
  const [screen, setScreen] = useState<"checking" | "chooser" | "training">("checking");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  useEffect(() => {
    const initData = getInitData();

    fetch("/api/mini-app/inventory-eligibility", {
      headers: initData ? { "Telegram-Init-Data": initData } : {},
    })
      .then((res) => (res.ok ? res.json() : { eligible: false }))
      .then((data) => setScreen(data?.eligible ? "chooser" : "training"))
      .catch(() => setScreen("training"));

    fetch("/api/mini-app/courses", {
      headers: initData ? { "Telegram-Init-Data": initData } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load courses.");
        return res.json();
      })
      .then((data) => setCourses(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const safeTopStyle = {
    paddingTop: `calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px) + 16px)`,
  };

  if (screen === "checking") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-slate-400 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        <p className="text-xs uppercase tracking-widest font-black">Loading...</p>
      </div>
    );
  }

  if (screen === "chooser") {
    return <AppChooser onOpenTraining={() => setScreen("training")} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-slate-400 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        <p className="text-xs uppercase tracking-widest font-black">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 p-6 text-center text-red-400 gap-4">
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-2xl">
          <X className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold">Failed to Load</h2>
        <p className="text-xs max-w-xs text-slate-400">{error}</p>
      </div>
    );
  }

  const active = courses.filter((c) => c.progressStatus !== "completed");
  const completed = courses.filter((c) => c.progressStatus === "completed");

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-4 pb-8" style={safeTopStyle}>
      <h1 className="text-xl font-bold text-white mb-1">Safety Training</h1>
      <p className="text-sm text-slate-400 mb-5">Your assigned courses.</p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mt-16 text-center text-slate-500">
          <BookOpen className="h-10 w-10 opacity-40" />
          <p className="text-sm">No courses assigned yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Active courses */}
          {active.length > 0 && (
            <ul className="flex flex-col gap-3">
              {active.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => router.push(`/mini-app/${course.id}`)}
                />
              ))}
            </ul>
          )}

          {/* Completed courses — collapsible */}
          {completed.length > 0 && (
            <div className="border border-emerald-800/30 rounded-2xl overflow-hidden">
              <button
                onClick={() => setCompletedOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-emerald-950/30 text-emerald-400 text-sm font-semibold"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed ({completed.length})
                </span>
                {completedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {completedOpen && (
                <ul className="flex flex-col gap-3 p-3">
                  {completed.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onClick={() => router.push(`/mini-app/${course.id}`)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
