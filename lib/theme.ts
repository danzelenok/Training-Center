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
  deepInk: string;
  deepMuted: string;
  lightInk: string;
  lightMuted: string;
  lineColor: string;
}

export interface ResolvedThemeVariant {
  name: string;
  patternCss: string; // content-card background (pairs with lightInk/lightMuted)
  deepCss: string; // cover-slide background (pairs with deepInk/deepMuted)
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

function hasResolvedTheme(course: ThemeableCourse): course is ThemeableCourse & {
  themePalette: ResolvedThemePalette;
  themeVariant: ResolvedThemeVariant;
} {
  return !!(course.themePaletteId && course.themeVariantId && course.themePalette && course.themeVariant);
}

/**
 * Turns a stored multi-layer CSS background value (comma-joined gradient
 * functions, optionally ending in a plain color — see
 * scripts/seed-theme-palettes.ts) into a style object using the
 * `background` shorthand rather than `backgroundImage`.
 *
 * This matters: `background-image` only accepts <image> values (gradient
 * functions, url()) in its comma-separated list — a bare color like
 * `#f4ece0` is not a valid list item, and per the CSS spec an invalid item
 * anywhere in the list invalidates the *entire* declaration (not just that
 * layer), so the browser silently drops the whole background and falls
 * through to whatever's underneath. The `background` shorthand has no such
 * restriction: a plain color is valid as the *last* layer, where it's
 * interpreted as background-color. Every caller that assigns a raw
 * variant/preset CSS string to an element's background must go through
 * this helper — do not reintroduce a second `backgroundImage: ...` site.
 */
export function themeBackgroundStyle(css: string): CSSProperties {
  return { background: css };
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
  if (hasResolvedTheme(course)) {
    const css = options?.cover ? course.themeVariant.deepCss : course.themeVariant.patternCss;
    return { ...themeBackgroundStyle(css), borderRadius: course.themePalette.cardRadius };
  }

  const themeType = course.themeType || "preset";
  const themeValue = course.themeValue || LEGACY_DEFAULT_GRADIENT;

  if (themeType === "preset") {
    return themeBackgroundStyle(themeValue);
  } else if (themeType === "color") {
    return { backgroundColor: themeValue };
  } else if (themeType === "image") {
    return {
      backgroundImage: `url(${themeValue})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return themeBackgroundStyle(LEGACY_DEFAULT_GRADIENT);
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
  if (!hasResolvedTheme(course)) return {};
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

export interface ThemeInk {
  ink?: string;
  muted?: string;
  line?: string;
}

/**
 * Text color paired with getCardBgStyle's background choice — pass the
 * same `options.cover` value used for the background call so ink and
 * background always agree (deepInk on deepCss, lightInk on patternCss).
 * Empty object for a legacy course, same convention as getThemeTypography.
 */
export function getThemeInk(course: ThemeableCourse, options?: { cover?: boolean }): ThemeInk {
  if (!hasResolvedTheme(course)) return {};
  const p = course.themePalette;
  return options?.cover
    ? { ink: p.deepInk, muted: p.deepMuted, line: p.lineColor }
    : { ink: p.lightInk, muted: p.lightMuted, line: p.lineColor };
}
