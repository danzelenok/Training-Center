import type { CSSProperties } from "react";

// Kept in sync with the `theme_value` column default in db/schema.ts — the
// last-resort background when a course has no theme data at all.
const LEGACY_DEFAULT_GRADIENT = "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)";

export interface ThemeableCourse {
  themeType?: string | null;
  themeValue?: string | null;
  themePaletteId?: string | null;
  themeVariantId?: string | null;
}

export interface ResolvedThemeVariant {
  patternCss: string;
}

/**
 * Shared by CardCanvas.tsx (editor) and story-player.tsx (player) — was
 * previously duplicated 1:1 in both. When a course has been migrated to
 * Theme System v2 (themePaletteId + themeVariantId both set) and the caller
 * has already resolved that variant, its patternCss wins. Otherwise this
 * falls back to the original themeType/themeValue logic unchanged, so a
 * legacy course (themePaletteId/themeVariantId null) renders identically to
 * before this refactor.
 *
 * In practice the v2 write path (updateCourseStyle in CourseEditorContext)
 * always keeps themeValue in sync with the chosen variant's patternCss, so
 * passing resolvedVariant is an optional optimization/future-proofing, not
 * a requirement for correct rendering — callers that don't have it loaded
 * (e.g. story-player.tsx today) still render the right background via the
 * legacy fallback.
 */
export function getCardBgStyle(
  course: ThemeableCourse,
  resolvedVariant?: ResolvedThemeVariant | null
): CSSProperties {
  if (course.themePaletteId && course.themeVariantId && resolvedVariant) {
    return { backgroundImage: resolvedVariant.patternCss };
  }

  const themeType = course.themeType || "preset";
  const themeValue = course.themeValue || LEGACY_DEFAULT_GRADIENT;

  if (themeType === "preset") {
    return { backgroundImage: themeValue };
  } else if (themeType === "color") {
    return { backgroundColor: themeValue };
  } else if (themeType === "image") {
    return {
      backgroundImage: `url(${themeValue})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { backgroundImage: LEGACY_DEFAULT_GRADIENT };
}
