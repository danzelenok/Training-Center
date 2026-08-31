"use client";

import React, { use, useEffect, useState } from "react";
import { X } from "lucide-react";
import { StoryPlayer } from "@/components/mini-app/story-player";
import { Slide } from "@/components/admin/course-editor/CardCanvas";
import type { JurisdictionRef } from "@/hooks/admin/workers/types";
import type { ResolvedThemePalette, ResolvedThemeVariant } from "@/lib/theme";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CoursePreviewPage({ params }: PageProps) {
  const { id } = use(params);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionRef[]>([]);
  const [themeType, setThemeType] = useState<string | undefined>();
  const [themeValue, setThemeValue] = useState<string | undefined>();
  const [themePaletteId, setThemePaletteId] = useState<string | null | undefined>();
  const [themeVariantId, setThemeVariantId] = useState<string | null | undefined>();
  const [themePalette, setThemePalette] = useState<ResolvedThemePalette | null | undefined>();
  const [themeVariant, setThemeVariant] = useState<ResolvedThemeVariant | null | undefined>();
  const [fontFamilyOverride, setFontFamilyOverride] = useState<string | null | undefined>();
  const [textColorOverride, setTextColorOverride] = useState<string | null | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlides() {
      try {
        const res = await fetch(`/api/courses/${id}`);
        if (!res.ok) {
          throw new Error("Failed to load course slides.");
        }
        const data = await res.json();
        if (!data.slides?.length) throw new Error("This course contains no slides.");
        setSlides(data.slides as Slide[]);
        setThemeType(data.themeType);
        setThemeValue(data.themeValue);
        setThemePaletteId(data.themePaletteId);
        setThemeVariantId(data.themeVariantId);
        setThemePalette(data.themePalette);
        setThemeVariant(data.themeVariant);
        setFontFamilyOverride(data.fontFamilyOverride);
        setTextColorOverride(data.textColorOverride);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }
    fetchSlides();

    fetch("/api/admin/jurisdictions")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setJurisdictions(data))
      .catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3 z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        <p className="text-xs uppercase tracking-widest font-black">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-red-400 gap-4 z-50">
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-2xl">
          <X className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold">Failed to Load Preview</h2>
        <p className="text-xs max-w-xs text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center">
      <div className="relative h-full w-full max-w-[420px] overflow-hidden">
        <StoryPlayer
          slides={slides}
          themeType={themeType}
          themeValue={themeValue}
          themePaletteId={themePaletteId}
          themeVariantId={themeVariantId}
          themePalette={themePalette}
          themeVariant={themeVariant}
          fontFamilyOverride={fontFamilyOverride}
          textColorOverride={textColorOverride}
          jurisdictionBadges={jurisdictions}
        />
      </div>
    </div>
  );
}
