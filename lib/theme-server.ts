import { db } from "@/db";
import { themePalettes, themePatternVariants } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ResolvedThemePalette, ResolvedThemeVariant } from "./theme";

/**
 * Server-only join of a course's themePaletteId/themeVariantId into the
 * full palette/variant rows, for API routes to embed in their response.
 * Returns nulls for a legacy course (either id unset) or a dangling
 * reference (the referenced row was deleted) — callers should treat both
 * the same way lib/theme.ts's getCardBgStyle does: fall back to
 * themeType/themeValue.
 */
export async function resolveCourseTheme(
  themePaletteId: string | null | undefined,
  themeVariantId: string | null | undefined
): Promise<{ themePalette: ResolvedThemePalette | null; themeVariant: ResolvedThemeVariant | null }> {
  if (!themePaletteId || !themeVariantId) {
    return { themePalette: null, themeVariant: null };
  }

  const [palette] = await db
    .select({
      fontFamily: themePalettes.fontFamily,
      displayFontFamily: themePalettes.displayFontFamily,
      fontWeight: themePalettes.fontWeight,
      letterSpacing: themePalettes.letterSpacing,
      cardRadius: themePalettes.cardRadius,
      accentColor: themePalettes.accentColor,
      accentInkColor: themePalettes.accentInkColor,
      isDark: themePalettes.isDark,
    })
    .from(themePalettes)
    .where(eq(themePalettes.id, themePaletteId))
    .limit(1);

  const [variant] = await db
    .select({
      name: themePatternVariants.name,
      patternCss: themePatternVariants.patternCss,
      deepCss: themePatternVariants.deepCss,
    })
    .from(themePatternVariants)
    .where(eq(themePatternVariants.id, themeVariantId))
    .limit(1);

  return { themePalette: palette ?? null, themeVariant: variant ?? null };
}
