"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, X } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string | null;
}

export default function MiniAppPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [safeTop, setSafeTop] = useState(0);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      setSafeTop(tg.safeAreaInset?.top ?? 0);
    }
  }, []);

  useEffect(() => {
    fetch("/api/mini-app/courses")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load courses.");
        return res.json();
      })
      .then((data) => setCourses(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
    <main className="flex-1 overflow-y-auto bg-slate-950 p-4" style={{ paddingTop: safeTop + 16 }}>
      <h1 className="text-xl font-bold text-white mb-1">Safety Training</h1>
      <p className="text-sm text-slate-400 mb-5">Choose a course to get started.</p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mt-16 text-center text-slate-500">
          <BookOpen className="h-10 w-10 opacity-40" />
          <p className="text-sm">No courses available yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-white leading-snug">{course.title}</h2>
                {course.description && (
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                    {course.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => router.push(`/mini-app/${course.id}`)}
                className="w-full bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
              >
                Start Learning
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
