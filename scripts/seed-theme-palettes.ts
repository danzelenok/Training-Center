/**
 * Seed for Theme System v2: 5 construction/safety-appropriate palettes, each
 * bundling a typographic identity (body + display font, weight, tracking,
 * corner radius, accent) alongside 5 background-pattern variants. Each
 * variant carries two coordinated backgrounds — `patternCss` (content-card,
 * pairs with light ink) and `deepCss` (cover-slide, pairs with light-on-dark
 * ink) — into `theme_palettes` / `theme_pattern_variants`.
 *
 * Idempotent — safe to run more than once. `theme_palettes.name` has no
 * unique constraint (per spec), so idempotency is done by explicit
 * existence-check instead of ON CONFLICT: a palette is looked up by name
 * before insert, and each variant is looked up by (palette_id,
 * variant_index) and UPDATEd in place if found rather than re-inserted — so
 * editing a variant's CSS in this file and re-running the script pushes the
 * update without ever creating duplicate rows.
 *
 * Does NOT touch `courses` — existing courses stay on their legacy
 * theme_type/theme_value until an admin explicitly re-picks a palette for
 * them through the editor UI.
 *
 * Run with:
 *   npx tsx scripts/seed-theme-palettes.ts
 */

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

// ─── Load .env.local ─────────────────────────────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const root = path.resolve(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface BaseColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface PaletteDef {
  name: string;
  sortOrder: number;
  colors: BaseColors;
  fontFamily: string;
  displayFontFamily: string;
  fontWeight: number;
  letterSpacing: string;
  cardRadius: number;
  accentColor: string;
  accentInkColor: string;
  isDark: boolean;
}

// Muted, B2B-appropriate palettes for an OSHA/L&I compliance training
// product — construction-adjacent without being "playful". Each bundles a
// distinct typographic identity (font/weight/tracking/radius), not just
// color, so picking a palette visibly changes the feel of the course cards.
const PALETTES: PaletteDef[] = [
  {
    name: "Ocean Blue",
    sortOrder: 1,
    colors: { primary: "#0B3C5D", secondary: "#1E5F8C", accent: "#4FA8D8" },
    fontFamily: "var(--font-manrope), sans-serif",
    displayFontFamily: "var(--font-manrope), sans-serif",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    cardRadius: 20,
    accentColor: "#4FA8D8",
    accentInkColor: "#0B3C5D",
    isDark: false,
  },
  {
    name: "Safety Orange",
    sortOrder: 2,
    colors: { primary: "#C1440E", secondary: "#E8703A", accent: "#F4A261" },
    fontFamily: "var(--font-space-grotesk), sans-serif",
    displayFontFamily: "var(--font-space-grotesk), sans-serif",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    cardRadius: 8,
    accentColor: "#E8703A",
    accentInkColor: "#FFF6EC",
    isDark: false,
  },
  {
    name: "Steel Gray",
    sortOrder: 3,
    colors: { primary: "#37474F", secondary: "#546E7A", accent: "#90A4AE" },
    fontFamily: "var(--font-ibm-plex-mono), monospace",
    displayFontFamily: "var(--font-space-grotesk), sans-serif",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    cardRadius: 12,
    accentColor: "#D9A441",
    accentInkColor: "#20262A",
    isDark: false,
  },
  {
    name: "Site Green",
    sortOrder: 4,
    colors: { primary: "#1B4332", secondary: "#2D6A4F", accent: "#52B788" },
    fontFamily: "var(--font-dm-sans), sans-serif",
    displayFontFamily: "var(--font-dm-sans), sans-serif",
    fontWeight: 700,
    letterSpacing: "-0.015em",
    cardRadius: 24,
    accentColor: "#52B788",
    accentInkColor: "#0F2A1E",
    isDark: false,
  },
  {
    name: "Deep Navy",
    sortOrder: 5,
    colors: { primary: "#0D1B2A", secondary: "#1B3A4B", accent: "#2C5364" },
    fontFamily: "var(--font-manrope), sans-serif",
    displayFontFamily: "var(--font-manrope), sans-serif",
    fontWeight: 800,
    letterSpacing: "-0.025em",
    cardRadius: 16,
    accentColor: "#5FA8FF",
    accentInkColor: "#0A1420",
    isDark: true,
  },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface VariantDef {
  name: string;
  patternCss: string;
  deepCss: string;
}

// Builds the 5 pattern variants for a palette: each carries a content
// background (`patternCss`, subtler, pairs with light ink) and a cover
// background (`deepCss`, richer/more saturated, often glowing with the
// palette's accent, pairs with light-on-dark ink) — mirrors a course's
// cover slide vs. its regular content slides. CSS-only (gradients,
// repeating-gradients) — no images, no SVG.
function buildVariants(colors: BaseColors, accentColor: string): VariantDef[] {
  const { primary, secondary, accent } = colors;
  const glowSoft = hexToRgba(accentColor, 0.18);
  const glowStrong = hexToRgba(accentColor, 0.45);
  const dotSoft = hexToRgba(accentColor, 0.35);

  return [
    {
      name: "Smooth",
      patternCss: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      deepCss: `linear-gradient(165deg, ${secondary} 0%, ${primary} 100%)`,
    },
    {
      name: "Glow",
      patternCss: `radial-gradient(120% 80% at 10% 105%, ${glowSoft} 0%, transparent 66%), linear-gradient(165deg, ${primary} 0%, ${secondary} 100%)`,
      deepCss: `radial-gradient(130% 85% at 15% 105%, ${glowStrong} 0%, transparent 62%), linear-gradient(165deg, ${secondary} 0%, ${primary} 100%)`,
    },
    {
      name: "Stripes",
      patternCss: `repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 14px), linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      deepCss: `repeating-linear-gradient(115deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 2px, transparent 2px, transparent 16px), linear-gradient(160deg, ${secondary} 0%, ${primary} 100%)`,
    },
    {
      name: "Grid",
      patternCss: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.5px) 0 0/16px 16px, linear-gradient(160deg, ${primary} 0%, ${accent} 100%)`,
      deepCss: `radial-gradient(${dotSoft} 1.4px, transparent 1.5px) 0 0/9px 9px, linear-gradient(160deg, ${secondary} 0%, ${primary} 100%)`,
    },
    {
      name: "Crosshatch",
      patternCss: `repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px), linear-gradient(200deg, ${secondary} 0%, ${primary} 100%)`,
      deepCss: `repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 10px), radial-gradient(90% 55% at 50% 105%, ${glowStrong} 0%, transparent 65%), linear-gradient(200deg, ${primary} 0%, ${secondary} 100%)`,
    },
  ];
}

async function main() {
  for (const palette of PALETTES) {
    let paletteId: string;

    const [existing] = await sql.query(`SELECT id FROM theme_palettes WHERE name = $1 LIMIT 1`, [palette.name]);

    const paletteColumns = {
      base_colors: JSON.stringify(palette.colors),
      sort_order: palette.sortOrder,
      font_family: palette.fontFamily,
      display_font_family: palette.displayFontFamily,
      font_weight: palette.fontWeight,
      letter_spacing: palette.letterSpacing,
      card_radius: palette.cardRadius,
      accent_color: palette.accentColor,
      accent_ink_color: palette.accentInkColor,
      is_dark: palette.isDark,
    };

    if (existing) {
      paletteId = existing.id;
      await sql.query(
        `UPDATE theme_palettes SET
           base_colors = $1, sort_order = $2, font_family = $3, display_font_family = $4,
           font_weight = $5, letter_spacing = $6, card_radius = $7, accent_color = $8,
           accent_ink_color = $9, is_dark = $10
         WHERE id = $11`,
        [
          paletteColumns.base_colors,
          paletteColumns.sort_order,
          paletteColumns.font_family,
          paletteColumns.display_font_family,
          paletteColumns.font_weight,
          paletteColumns.letter_spacing,
          paletteColumns.card_radius,
          paletteColumns.accent_color,
          paletteColumns.accent_ink_color,
          paletteColumns.is_dark,
          paletteId,
        ]
      );
      console.log(`Palette "${palette.name}": already existed (${paletteId}), refreshed.`);
    } else {
      const [row] = await sql.query(
        `INSERT INTO theme_palettes
           (name, base_colors, sort_order, font_family, display_font_family, font_weight,
            letter_spacing, card_radius, accent_color, accent_ink_color, is_dark)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          palette.name,
          paletteColumns.base_colors,
          paletteColumns.sort_order,
          paletteColumns.font_family,
          paletteColumns.display_font_family,
          paletteColumns.font_weight,
          paletteColumns.letter_spacing,
          paletteColumns.card_radius,
          paletteColumns.accent_color,
          paletteColumns.accent_ink_color,
          paletteColumns.is_dark,
        ]
      );
      paletteId = row.id;
      console.log(`Palette "${palette.name}": created (${paletteId}).`);
    }

    const variants = buildVariants(palette.colors, palette.accentColor);
    for (let i = 0; i < variants.length; i++) {
      const variantIndex = i + 1;
      const variant = variants[i];

      const [existingVariant] = await sql.query(
        `SELECT id FROM theme_pattern_variants WHERE palette_id = $1 AND variant_index = $2 LIMIT 1`,
        [paletteId, variantIndex]
      );

      if (existingVariant) {
        await sql.query(`UPDATE theme_pattern_variants SET name = $1, pattern_css = $2, deep_css = $3 WHERE id = $4`, [
          variant.name,
          variant.patternCss,
          variant.deepCss,
          existingVariant.id,
        ]);
      } else {
        await sql.query(
          `INSERT INTO theme_pattern_variants (palette_id, variant_index, name, pattern_css, deep_css) VALUES ($1, $2, $3, $4, $5)`,
          [paletteId, variantIndex, variant.name, variant.patternCss, variant.deepCss]
        );
      }
    }
    console.log(`  → ${variants.length} variant(s) upserted.`);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
