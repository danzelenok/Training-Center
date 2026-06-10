"use client";

import React, { use, useEffect, useState } from "react";
import { X } from "lucide-react";
import { StoryPlayer } from "@/components/mini-app/story-player";
import { Slide } from "@/components/admin/course-editor/CardCanvas";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function MiniAppCoursePage({ params }: PageProps) {
  const { courseId } = use(params);

  const [slides, setSlides] = useState<Slide[]>([]);
  const [themeType, setThemeType] = useState<string | undefined>();
  const [themeValue, setThemeValue] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlides() {
      try {
        const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";

        const headers: Record<string, string> = isPreview
          ? { "x-preview-mode": "true" }
          : {
              "Telegram-Init-Data":
                (window as any).Telegram?.WebApp?.initData ||
                (process.env.NODE_ENV === "development" ? "mock-dev-data" : ""),
            };

        const res = await fetch(`/api/courses/${courseId}/slides`, { headers });

        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "Unauthorized. Please open this course inside Telegram."
              : "Failed to load course slides."
          );
        }

        const data = await res.json();
        if (!data.slides?.length) throw new Error("This course contains no slides.");
        setSlides(data.slides as Slide[]);
        setThemeType(data.course?.themeType);
        setThemeValue(data.course?.themeValue);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchSlides();
  }, [courseId]);

  if (!courseId) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <div className="w-full max-w-md text-center flex flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Invalid Course
          </h1>
          <p className="text-sm text-slate-400">
            Please open this mini-app via a valid course link in Telegram.
          </p>
        </div>
      </main>
    );
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
        <h2 className="text-lg font-bold">Failed to Start</h2>
        <p className="text-xs max-w-xs text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <main className="w-full min-h-screen bg-black">
      <StoryPlayer slides={slides} themeType={themeType} themeValue={themeValue} />
    </main>
  );
}
