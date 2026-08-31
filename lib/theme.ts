import type { CSSProperties } from "react";

// Kept in sync with the `theme_value` column default in db/schema.ts — the
// last-resort background when a course has no theme data at all.
const LEGACY_DEFAULT_GRADIENT = "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)";

export interface ResolvedThemePalette {
  fontFamily: string;
  displayFontFamily: string;
  fontWeight: number;
  letterSpacing: string;
  cardRadius: number;
  accentColor: string;
  accentInkColor: string;
  isDark: boolean;
}

export interface ResolvedThemeVariant {
  name: string;
  patternCss: string; // content-card background (pairs with light ink)
  deepCss: string; // cover-slide background (pairs with light-on-dark ink)
}

export interface ThemeableCourse {
  themeType?: string | null;
  themeValue?: string | null;
  themePaletteId?: string | null;
  themeVariantId?: string | null;
  // Server-resolved join of themePaletteId/themeVariantId — null until both
  // the API route resolves them AND the course actually has them set.
  themePalette?: ResolvedThemePalette | null;
  themeVariant?: ResolvedThemeVariant | null;
}

/**
 * Shared by CardCanvas.tsx (editor), story-player.tsx (player), and
 * TextSlide.tsx — was previously duplicated 1:1 between the first two. When
 * a course has been migrated to Theme System v2 (themePaletteId +
 * themeVariantId set, and the server has resolved the join into
 * themePalette/themeVariant) its variant CSS wins; otherwise this falls
 * back to the original themeType/themeValue logic unchanged, so a legacy
 * course renders identically to before this module existed.
 *
 * `options.cover` selects the richer/more-saturated `deepCss` treatment —
 * intended for a course's first/cover slide, mirroring the "cover vs.
 * content" split the design this was adapted from uses. Every other slide
 * uses `patternCss`.
 */
export function getCardBgStyle(course: ThemeableCourse, options?: { cover?: boolean }): CSSProperties {
  if (course.themePaletteId && course.themeVariantId && course.themePalette && course.themeVariant) {
    const backgroundImage = options?.cover ? course.themeVariant.deepCss : course.themeVariant.patternCss;
    return { backgroundImage, borderRadius: course.themePalette.cardRadius };
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

export interface ThemeTypography {
  fontFamily?: string;
  displayFontFamily?: string;
  fontWeight?: number;
  letterSpacing?: string;
  accentColor?: string;
  accentInkColor?: string;
  isDark?: boolean;
}

/**
 * Typography/accent identity for a Theme System v2 course — empty object
 * for a legacy course (themePaletteId unset, or not yet resolved), which
 * callers should treat as "use the existing hardcoded defaults" rather than
 * force any particular font.
 */
export function getThemeTypography(course: ThemeableCourse): ThemeTypography {
  if (!(course.themePaletteId && course.themeVariantId && course.themePalette)) {
    return {};
  }
  const p = course.themePalette;
  return {
    fontFamily: p.fontFamily,
    displayFontFamily: p.displayFontFamily,
    fontWeight: p.fontWeight,
    letterSpacing: p.letterSpacing,
    accentColor: p.accentColor,
    accentInkColor: p.accentInkColor,
    isDark: p.isDark,
  };
}
