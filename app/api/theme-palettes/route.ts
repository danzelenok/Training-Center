import { db } from "@/db";
import { themePalettes, themePatternVariants } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/theme-palettes — platform-wide reference data (not org-scoped,
// same convention as /api/admin/jurisdictions): every org sees the same
// palette/variant catalog. Auth-gated only, no org filter.
export async function GET() {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const palettes = await db
      .select({
        id: themePalettes.id,
        name: themePalettes.name,
        baseColors: themePalettes.baseColors,
        sortOrder: themePalettes.sortOrder,
      })
      .from(themePalettes)
      .orderBy(asc(themePalettes.sortOrder));

    const variants = await db
      .select({
        id: themePatternVariants.id,
        paletteId: themePatternVariants.paletteId,
        variantIndex: themePatternVariants.variantIndex,
        patternCss: themePatternVariants.patternCss,
      })
      .from(themePatternVariants)
      .orderBy(asc(themePatternVariants.variantIndex));

    const variantsByPalette = new Map<string, typeof variants>();
    for (const variant of variants) {
      const list = variantsByPalette.get(variant.paletteId) ?? [];
      list.push(variant);
      variantsByPalette.set(variant.paletteId, list);
    }

    const result = palettes.map((palette) => ({
      ...palette,
      variants: variantsByPalette.get(palette.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching theme palettes:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
