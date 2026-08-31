/**
 * Seed for Theme System v2: 5 construction/safety-appropriate color palettes,
 * each with 5 background-pattern variants, into `theme_palettes` /
 * `theme_pattern_variants`.
 *
 * Idempotent — safe to run more than once. `theme_palettes.name` has no
 * unique constraint (per spec), so idempotency is done by explicit
 * existence-check instead of ON CONFLICT: a palette is looked up by name
 * before insert, and each variant is looked up by (palette_id,
 * variant_index) and its `pattern_css` is UPDATEd in place if found rather
 * than re-inserted — so editing a variant's CSS in this file and re-running
 * the script pushes the update without ever creating duplicate rows.
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
}

// Muted, B2B-appropriate palettes for an OSHA/L&I compliance training
// product — construction-adjacent without being "playful".
const PALETTES: PaletteDef[] = [
  { name: "Ocean Blue", sortOrder: 1, colors: { primary: "#0B3C5D", secondary: "#1E5F8C", accent: "#4FA8D8" } },
  { name: "Safety Orange", sortOrder: 2, colors: { primary: "#C1440E", secondary: "#E8703A", accent: "#F4A261" } },
  { name: "Steel Gray", sortOrder: 3, colors: { primary: "#37474F", secondary: "#546E7A", accent: "#90A4AE" } },
  { name: "Site Green", sortOrder: 4, colors: { primary: "#1B4332", secondary: "#2D6A4F", accent: "#52B788" } },
  { name: "Deep Navy", sortOrder: 5, colors: { primary: "#0D1B2A", secondary: "#1B3A4B", accent: "#2C5364" } },
];

// Builds the 5 pattern-variant CSS strings for a palette: two plain gradients
// at different angles, then three gradient + subtle-overlay combinations
// (diagonal stripes, dot grid, crosshatch), all using only background-image
// layers — no SVG, no external assets.
function buildVariants(colors: BaseColors): string[] {
  const { primary, secondary, accent } = colors;
  return [
    // 1. Plain diagonal gradient, primary → secondary
    `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    // 2. Plain diagonal gradient, reversed angle, secondary → accent
    `linear-gradient(225deg, ${secondary} 0%, ${accent} 100%)`,
    // 3. Gradient + faint diagonal stripes
    `repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 14px), linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    // 4. Gradient + faint dot grid
    `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.5px), linear-gradient(160deg, ${primary} 0%, ${accent} 100%)`,
    // 5. Gradient + faint crosshatch (two opposing stripe layers)
    `repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px), linear-gradient(200deg, ${secondary} 0%, ${primary} 100%)`,
  ];
}

async function main() {
  for (const palette of PALETTES) {
    let paletteId: string;

    const [existing] = await sql.query(`SELECT id FROM theme_palettes WHERE name = $1 LIMIT 1`, [palette.name]);

    if (existing) {
      paletteId = existing.id;
      await sql.query(
        `UPDATE theme_palettes SET base_colors = $1, sort_order = $2 WHERE id = $3`,
        [JSON.stringify(palette.colors), palette.sortOrder, paletteId]
      );
      console.log(`Palette "${palette.name}": already existed (${paletteId}), refreshed colors/sortOrder.`);
    } else {
      const [row] = await sql.query(
        `INSERT INTO theme_palettes (name, base_colors, sort_order) VALUES ($1, $2, $3) RETURNING id`,
        [palette.name, JSON.stringify(palette.colors), palette.sortOrder]
      );
      paletteId = row.id;
      console.log(`Palette "${palette.name}": created (${paletteId}).`);
    }

    const variants = buildVariants(palette.colors);
    for (let i = 0; i < variants.length; i++) {
      const variantIndex = i + 1;
      const patternCss = variants[i];

      const [existingVariant] = await sql.query(
        `SELECT id FROM theme_pattern_variants WHERE palette_id = $1 AND variant_index = $2 LIMIT 1`,
        [paletteId, variantIndex]
      );

      if (existingVariant) {
        await sql.query(`UPDATE theme_pattern_variants SET pattern_css = $1 WHERE id = $2`, [
          patternCss,
          existingVariant.id,
        ]);
      } else {
        await sql.query(
          `INSERT INTO theme_pattern_variants (palette_id, variant_index, pattern_css) VALUES ($1, $2, $3)`,
          [paletteId, variantIndex, patternCss]
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
