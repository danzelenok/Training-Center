"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Clock, X } from "lucide-react";


type ProgressStatus = "not_started" | "in_progress" | "completed";

interface Course {
  id: string;
  title: string;
  description: string | null;
  progressStatus: ProgressStatus;
  currentSlideIndex: number;
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

export default function MiniAppPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const initData =
      (window as any).Telegram?.WebApp?.initData ||
      (process.env.NODE_ENV === "development" ? "mock-dev-data" : "");

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

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-4 pb-8" style={safeTopStyle}>
      <h1 className="text-xl font-bold text-white mb-1">Safety Training</h1>
      <p className="text-sm text-slate-400 mb-5">Your assigned courses.</p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mt-16 text-center text-slate-500">
          <BookOpen className="h-10 w-10 opacity-40" />
          <p className="text-sm">No courses available yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course) => {
            const isCompleted = course.progressStatus === "completed";
            const isInProgress = course.progressStatus === "in_progress";

            return (
              <li
                key={course.id}
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
                  onClick={() => router.push(`/mini-app/${course.id}`)}
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
          })}
        </ul>
      )}
    </main>
  );
}
