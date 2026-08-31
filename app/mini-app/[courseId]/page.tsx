"use client";

import React, { use, useEffect, useState } from "react";
import { X } from "lucide-react";
import { StoryPlayer } from "@/components/mini-app/story-player";
import { Slide } from "@/components/admin/course-editor/CardCanvas";
import type { ResolvedThemePalette, ResolvedThemeVariant } from "@/lib/theme";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function MiniAppCoursePage({ params }: PageProps) {
  const { courseId } = use(params);

  const [slides, setSlides] = useState<Slide[]>([]);
  const [themeType, setThemeType] = useState<string | undefined>();
  const [themeValue, setThemeValue] = useState<string | undefined>();
  const [themePaletteId, setThemePaletteId] = useState<string | null | undefined>();
  const [themeVariantId, setThemeVariantId] = useState<string | null | undefined>();
  const [themePalette, setThemePalette] = useState<ResolvedThemePalette | null | undefined>();
  const [themeVariant, setThemeVariant] = useState<ResolvedThemeVariant | null | undefined>();
  const [fontFamilyOverride, setFontFamilyOverride] = useState<string | null | undefined>();
  const [textColorOverride, setTextColorOverride] = useState<string | null | undefined>();
  const [initData, setInitData] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  async function fetchSlides(initData: string) {
    try {
      const res = await fetch(`/api/courses/${courseId}/slides`, {
        headers: { "Telegram-Init-Data": initData },
      });

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
      setThemePaletteId(data.course?.themePaletteId);
      setThemeVariantId(data.course?.themeVariantId);
      setThemePalette(data.course?.themePalette);
      setThemeVariant(data.course?.themeVariant);
      setFontFamilyOverride(data.course?.fontFamilyOverride);
      setTextColorOverride(data.course?.textColorOverride);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      const initData =
        typeof window !== "undefined"
          ? (window as any).Telegram?.WebApp?.initData ||
            (process.env.NODE_ENV === "development" ? "mock-dev-data" : "")
          : "";
      setInitData(initData);

      try {
        const meRes = await fetch("/api/mini-app/me", {
          headers: { "Telegram-Init-Data": initData },
        });
        if (!meRes.ok) {
          throw new Error(
            meRes.status === 401
              ? "Unauthorized. Please open this course inside Telegram."
              : "Failed to load your profile."
          );
        }
        const me = await meRes.json();
        if (!me.displayName) {
          setNeedsOnboarding(true);
          setLoading(false);
          return;
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
        setLoading(false);
        return;
      }

      await fetchSlides(initData);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setOnboardingError("Please enter your name.");
      return;
    }

    setSavingName(true);
    setOnboardingError(null);
    try {
      const res = await fetch("/api/mini-app/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Telegram-Init-Data": initData,
        },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to save your name.");

      setNeedsOnboarding(false);
      setLoading(true);
      await fetchSlides(initData);
    } catch (err: any) {
      setOnboardingError(err.message || "Failed to save your name.");
    } finally {
      setSavingName(false);
    }
  }

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

  if (needsOnboarding) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <form
          onSubmit={handleOnboardingSubmit}
          className="w-full max-w-md text-center flex flex-col gap-5"
        >
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Welcome
          </h1>
          <p className="text-sm text-slate-400">Enter your name to get started</p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={100}
            autoFocus
            placeholder="Your name"
            className="w-full rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {onboardingError && (
            <p className="text-xs text-red-400">{onboardingError}</p>
          )}
          <button
            type="submit"
            disabled={savingName}
            className="w-full text-sm font-semibold rounded-xl py-3 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white transition-colors disabled:opacity-50"
          >
            {savingName ? "Saving..." : "Continue"}
          </button>
        </form>
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
      <StoryPlayer
        slides={slides}
        courseId={courseId}
        initData={initData}
        themeType={themeType}
        themeValue={themeValue}
        themePaletteId={themePaletteId}
        themeVariantId={themeVariantId}
        themePalette={themePalette}
        themeVariant={themeVariant}
        fontFamilyOverride={fontFamilyOverride}
        textColorOverride={textColorOverride}
      />
    </main>
  );
}
