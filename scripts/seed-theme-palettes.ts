/**
 * Seed for Theme System v2 — ports the 6 themes (each with 4 texture
 * variants) from a Claude Design reference artifact the user supplied,
 * verbatim: same fonts, weights, tracking, radii, accent/ink colors, and
 * gradient layers. Only the theme/variant *names* are translated to
 * English (product copy must be English-only, per AGENTS.md) — the visual
 * design itself is not reinterpreted.
 *
 * Each texture variant carries two coordinated multi-layer backgrounds —
 * `patternCss` (content-card, pairs with lightInk/lightMuted) and
 * `deepCss` (cover-slide, pairs with deepInk/deepMuted) — matching the
 * artifact's `tex[].light` / `tex[].deep` layer arrays (joined into a
 * single comma-separated `background-image` value, since CSS supports
 * stacking multiple gradients that way).
 *
 * Idempotent — safe to run more than once. `theme_palettes.name` has no
 * unique constraint (per spec), so idempotency is done by explicit
 * existence-check instead of ON CONFLICT: a palette is looked up by name
 * before insert, and each variant is looked up by (palette_id,
 * variant_index) and UPDATEd in place if found rather than re-inserted —
 * so re-running this script after editing a value here pushes the update
 * without ever creating duplicate rows or changing any id (existing
 * courses that already reference a palette/variant keep working).
 *
 * Does NOT touch `courses` — a course only gets a palette/variant when an
 * admin explicitly picks one through the editor UI.
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

interface TextureDef {
  name: string;
  deep: string[]; // background-image layers, front-to-back
  light: string[];
}

interface ThemeDef {
  name: string;
  sortOrder: number;
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
  tex: TextureDef[];
}

const THEMES: ThemeDef[] = [
  {
    name: "Midnight",
    sortOrder: 1,
    fontFamily: "var(--font-manrope), sans-serif",
    displayFontFamily: "var(--font-manrope), sans-serif",
    fontWeight: 800,
    letterSpacing: "-0.025em",
    cardRadius: 22,
    accentColor: "#3d63ff",
    accentInkColor: "#ffffff",
    isDark: false,
    deepInk: "#ffffff",
    deepMuted: "rgba(255,255,255,.68)",
    lightInk: "#0f1a4a",
    lightMuted: "rgba(15,26,74,.62)",
    lineColor: "rgba(15,26,74,.14)",
    tex: [
      {
        name: "Smooth",
        deep: ["linear-gradient(165deg,#16266f 0%,#050a24 100%)"],
        light: ["linear-gradient(165deg,#f3f5ff 0%,#e2e8ff 100%)"],
      },
      {
        name: "Glow",
        deep: [
          "radial-gradient(130% 85% at 15% 105%, #3552d8 0%, transparent 62%)",
          "linear-gradient(165deg,#101a5c,#04061c)",
        ],
        light: [
          "radial-gradient(120% 80% at 10% 105%, #c9d6ff 0%, transparent 66%)",
          "linear-gradient(165deg,#f6f8ff,#eaeeff)",
        ],
      },
      {
        name: "Haze",
        deep: [
          "radial-gradient(60% 40% at 80% 15%, rgba(120,150,255,.34) 0%, transparent 70%)",
          "radial-gradient(70% 45% at 10% 70%, rgba(40,70,220,.5) 0%, transparent 72%)",
          "linear-gradient(180deg,#0c1348,#070b26)",
        ],
        light: [
          "radial-gradient(60% 40% at 85% 12%, rgba(150,170,255,.4) 0%, transparent 70%)",
          "radial-gradient(70% 45% at 5% 75%, rgba(190,205,255,.7) 0%, transparent 72%)",
          "#f2f4ff",
        ],
      },
      {
        name: "Grid",
        deep: [
          "repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 30px)",
          "repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 1px, transparent 1px 30px)",
          "linear-gradient(165deg,#111c60,#05081f)",
        ],
        light: [
          "repeating-linear-gradient(0deg, rgba(15,26,74,.07) 0 1px, transparent 1px 30px)",
          "repeating-linear-gradient(90deg, rgba(15,26,74,.07) 0 1px, transparent 1px 30px)",
          "#eef1ff",
        ],
      },
    ],
  },
  {
    name: "Amber",
    sortOrder: 2,
    fontFamily: "var(--font-manrope), sans-serif",
    displayFontFamily: "var(--font-manrope), sans-serif",
    fontWeight: 800,
    letterSpacing: "-0.025em",
    cardRadius: 22,
    accentColor: "#d4531a",
    accentInkColor: "#fff6ec",
    isDark: false,
    deepInk: "#fff6ec",
    deepMuted: "rgba(255,240,225,.72)",
    lightInk: "#4a2008",
    lightMuted: "rgba(74,32,8,.62)",
    lineColor: "rgba(74,32,8,.14)",
    tex: [
      {
        name: "Smooth",
        deep: ["linear-gradient(160deg,#f0913f 0%,#b8460f 100%)"],
        light: ["linear-gradient(160deg,#fdf3e6,#f8e2c6)"],
      },
      {
        name: "Sunset",
        deep: [
          "radial-gradient(120% 80% at 85% 0%, #ffc06a 0%, transparent 58%)",
          "linear-gradient(170deg,#d9631d,#7a2a08)",
        ],
        light: ["radial-gradient(120% 75% at 90% 0%, #ffe3b8 0%, transparent 62%)", "#fdf4e9"],
      },
      {
        name: "Wave",
        deep: [
          "radial-gradient(90% 55% at -10% 85%, rgba(255,206,140,.55) 0%, transparent 70%)",
          "radial-gradient(80% 50% at 110% 20%, rgba(255,160,70,.6) 0%, transparent 68%)",
          "linear-gradient(170deg,#c9531a,#8c3209)",
        ],
        light: [
          "radial-gradient(85% 50% at -5% 90%, rgba(246,205,157,.85) 0%, transparent 70%)",
          "radial-gradient(75% 48% at 108% 18%, rgba(250,222,185,.9) 0%, transparent 68%)",
          "#fdf5ec",
        ],
      },
      {
        name: "Stripes",
        deep: [
          "repeating-linear-gradient(115deg, rgba(255,255,255,.09) 0 2px, transparent 2px 16px)",
          "linear-gradient(160deg,#e2721f,#8e3409)",
        ],
        light: [
          "repeating-linear-gradient(115deg, rgba(180,90,30,.09) 0 2px, transparent 2px 16px)",
          "linear-gradient(160deg,#fdf2e2,#f7e0c2)",
        ],
      },
    ],
  },
  {
    name: "Risograph",
    sortOrder: 3,
    fontFamily: "var(--font-space-grotesk), sans-serif",
    displayFontFamily: "var(--font-space-grotesk), sans-serif",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    cardRadius: 6,
    accentColor: "#e33a12",
    accentInkColor: "#fdf6e8",
    isDark: false,
    deepInk: "#fdf6e8",
    deepMuted: "rgba(253,246,232,.72)",
    lightInk: "#1c1712",
    lightMuted: "rgba(28,23,18,.62)",
    lineColor: "rgba(28,23,18,.22)",
    tex: [
      { name: "Block", deep: ["#e33a12"], light: ["#f4ece0"] },
      {
        name: "Halftone",
        deep: ["radial-gradient(rgba(28,23,18,.28) 1.4px, transparent 1.5px) 0 0/9px 9px", "#e33a12"],
        light: ["radial-gradient(rgba(227,58,18,.35) 1.4px, transparent 1.5px) 0 0/9px 9px", "#f4ece0"],
      },
      {
        name: "Shift",
        deep: ["linear-gradient(90deg, rgba(20,60,180,.55) 0 34%, transparent 34%)", "#e33a12"],
        light: [
          "linear-gradient(90deg, rgba(227,58,18,.22) 0 26%, transparent 26%)",
          "linear-gradient(0deg, rgba(20,60,180,.14) 0 18%, transparent 18%)",
          "#f4ece0",
        ],
      },
      {
        name: "Hatch",
        deep: ["repeating-linear-gradient(45deg, rgba(20,20,20,.16) 0 3px, transparent 3px 11px)", "#e33a12"],
        light: ["repeating-linear-gradient(45deg, rgba(28,23,18,.12) 0 3px, transparent 3px 11px)", "#f4ece0"],
      },
    ],
  },
  {
    name: "Greenhouse",
    sortOrder: 4,
    fontFamily: "var(--font-dm-sans), sans-serif",
    displayFontFamily: "var(--font-newsreader), serif",
    fontWeight: 500,
    letterSpacing: "-0.015em",
    cardRadius: 26,
    accentColor: "#4a7a4e",
    accentInkColor: "#f4f8ee",
    isDark: false,
    deepInk: "#f2f6ec",
    deepMuted: "rgba(242,246,236,.72)",
    lightInk: "#1f3327",
    lightMuted: "rgba(31,51,39,.62)",
    lineColor: "rgba(31,51,39,.16)",
    tex: [
      {
        name: "Moss",
        deep: ["linear-gradient(170deg,#2c4a35,#16261c)"],
        light: ["linear-gradient(170deg,#eef2e6,#dde5d4)"],
      },
      {
        name: "Leaves",
        deep: [
          "radial-gradient(45% 30% at 15% 12%, rgba(150,190,130,.4) 0%, transparent 70%)",
          "radial-gradient(55% 35% at 95% 78%, rgba(110,160,100,.45) 0%, transparent 72%)",
          "linear-gradient(170deg,#28422f,#13211a)",
        ],
        light: [
          "radial-gradient(45% 28% at 12% 10%, rgba(160,195,140,.5) 0%, transparent 70%)",
          "radial-gradient(55% 34% at 96% 80%, rgba(190,214,170,.6) 0%, transparent 72%)",
          "#f0f4e9",
        ],
      },
      {
        name: "Steam",
        deep: [
          "repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 14px, transparent 14px 34px)",
          "linear-gradient(200deg,#2f5140,#152219)",
        ],
        light: [
          "repeating-linear-gradient(0deg, rgba(31,51,39,.05) 0 14px, transparent 14px 34px)",
          "linear-gradient(200deg,#f2f6ec,#e0e8d6)",
        ],
      },
      {
        name: "Arch",
        deep: [
          "radial-gradient(70% 46% at 50% 8%, rgba(146,186,126,.45) 0 62%, transparent 63%)",
          "linear-gradient(170deg,#264033,#12201a)",
        ],
        light: ["radial-gradient(70% 46% at 50% 6%, rgba(200,220,180,.75) 0 62%, transparent 63%)", "#f1f5ea"],
      },
    ],
  },
  {
    name: "Night Shift",
    sortOrder: 5,
    fontFamily: "var(--font-ibm-plex-mono), monospace",
    displayFontFamily: "var(--font-space-grotesk), sans-serif",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    cardRadius: 10,
    accentColor: "#c2f53f",
    accentInkColor: "#0d1110",
    isDark: true,
    deepInk: "#e9ffd0",
    deepMuted: "rgba(233,255,208,.6)",
    lightInk: "#d7dde0",
    lightMuted: "rgba(215,221,224,.6)",
    lineColor: "rgba(194,245,63,.28)",
    tex: [
      {
        name: "Asphalt",
        deep: ["linear-gradient(180deg,#141816,#080a09)"],
        light: ["linear-gradient(180deg,#1d2320,#121614)"],
      },
      {
        name: "Lane Markings",
        deep: [
          "repeating-linear-gradient(90deg, rgba(194,245,63,.14) 0 1px, transparent 1px 26px)",
          "linear-gradient(180deg,#151a17,#080a09)",
        ],
        light: [
          "repeating-linear-gradient(90deg, rgba(194,245,63,.1) 0 1px, transparent 1px 26px)",
          "linear-gradient(180deg,#1e2421,#121614)",
        ],
      },
      {
        name: "Scan",
        deep: [
          "repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 4px)",
          "radial-gradient(90% 55% at 50% 105%, rgba(194,245,63,.24) 0%, transparent 65%)",
          "#0b0e0c",
        ],
        light: ["repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 4px)", "#171c19"],
      },
      {
        name: "Headlight",
        deep: [
          "radial-gradient(80% 48% at 78% 6%, rgba(194,245,63,.42) 0%, transparent 62%)",
          "linear-gradient(200deg,#121714,#070908)",
        ],
        light: [
          "radial-gradient(80% 45% at 80% 4%, rgba(194,245,63,.16) 0%, transparent 62%)",
          "#161b18",
        ],
      },
    ],
  },
  {
    name: "Clay",
    sortOrder: 6,
    fontFamily: "var(--font-bricolage-grotesque), sans-serif",
    displayFontFamily: "var(--font-bricolage-grotesque), sans-serif",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    cardRadius: 30,
    accentColor: "#b8523a",
    accentInkColor: "#fdf0e4",
    isDark: false,
    deepInk: "#fdf0e4",
    deepMuted: "rgba(253,240,228,.74)",
    lightInk: "#43241a",
    lightMuted: "rgba(67,36,26,.62)",
    lineColor: "rgba(67,36,26,.16)",
    tex: [
      {
        name: "Terracotta",
        deep: ["linear-gradient(165deg,#c4634a,#8e3a2a)"],
        light: ["linear-gradient(165deg,#f6e7d8,#ecd6c2)"],
      },
      {
        name: "Circles",
        deep: [
          "radial-gradient(38% 22% at 78% 16%, rgba(255,214,180,.55) 0 99%, transparent 100%)",
          "radial-gradient(52% 30% at 8% 88%, rgba(120,50,35,.6) 0 99%, transparent 100%)",
          "linear-gradient(165deg,#c05c44,#8a3628)",
        ],
        light: [
          "radial-gradient(36% 21% at 80% 14%, rgba(228,175,140,.7) 0 99%, transparent 100%)",
          "radial-gradient(50% 29% at 6% 90%, rgba(214,190,165,.8) 0 99%, transparent 100%)",
          "#f7e9db",
        ],
      },
      {
        name: "Dunes",
        deep: [
          "radial-gradient(120% 40% at 50% 118%, rgba(255,206,170,.55) 0 60%, transparent 61%)",
          "radial-gradient(120% 40% at 50% 132%, rgba(255,226,196,.4) 0 60%, transparent 61%)",
          "linear-gradient(165deg,#b95440,#7f3124)",
        ],
        light: [
          "radial-gradient(120% 40% at 50% 118%, rgba(226,190,158,.75) 0 60%, transparent 61%)",
          "radial-gradient(120% 40% at 50% 132%, rgba(240,214,188,.7) 0 60%, transparent 61%)",
          "#f8ebde",
        ],
      },
      {
        name: "Grain",
        deep: [
          "repeating-radial-gradient(circle at 30% 30%, rgba(255,255,255,.07) 0 1px, transparent 1px 5px)",
          "linear-gradient(165deg,#c05e46,#87352a)",
        ],
        light: [
          "repeating-radial-gradient(circle at 30% 30%, rgba(67,36,26,.06) 0 1px, transparent 1px 5px)",
          "#f5e7d9",
        ],
      },
    ],
  },
];

// baseColors is a leftover summary field (primary/secondary/accent) kept
// populated for anything that still reads it — derived from each theme's
// first ("Smooth"-equivalent) deep texture's gradient stops.
function deriveBaseColors(theme: ThemeDef): { primary: string; secondary: string; accent: string } {
  const firstDeepLayer = theme.tex[0].deep[theme.tex[0].deep.length - 1];
  const stops = [...firstDeepLayer.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0]);
  return {
    primary: stops[0] ?? theme.accentColor,
    secondary: stops[1] ?? stops[0] ?? theme.accentColor,
    accent: theme.accentColor,
  };
}

async function main() {
  for (const theme of THEMES) {
    let paletteId: string;
    const baseColors = deriveBaseColors(theme);

    const [existing] = await sql.query(`SELECT id FROM theme_palettes WHERE name = $1 LIMIT 1`, [theme.name]);

    const values = [
      JSON.stringify(baseColors),
      theme.sortOrder,
      theme.fontFamily,
      theme.displayFontFamily,
      theme.fontWeight,
      theme.letterSpacing,
      theme.cardRadius,
      theme.accentColor,
      theme.accentInkColor,
      theme.isDark,
      theme.deepInk,
      theme.deepMuted,
      theme.lightInk,
      theme.lightMuted,
      theme.lineColor,
    ];

    if (existing) {
      paletteId = existing.id;
      await sql.query(
        `UPDATE theme_palettes SET
           base_colors = $1, sort_order = $2, font_family = $3, display_font_family = $4,
           font_weight = $5, letter_spacing = $6, card_radius = $7, accent_color = $8,
           accent_ink_color = $9, is_dark = $10, deep_ink = $11, deep_muted = $12,
           light_ink = $13, light_muted = $14, line_color = $15
         WHERE id = $16`,
        [...values, paletteId]
      );
      console.log(`Palette "${theme.name}": already existed (${paletteId}), refreshed.`);
    } else {
      const [row] = await sql.query(
        `INSERT INTO theme_palettes
           (name, base_colors, sort_order, font_family, display_font_family, font_weight,
            letter_spacing, card_radius, accent_color, accent_ink_color, is_dark,
            deep_ink, deep_muted, light_ink, light_muted, line_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id`,
        [theme.name, ...values]
      );
      paletteId = row.id;
      console.log(`Palette "${theme.name}": created (${paletteId}).`);
    }

    for (let i = 0; i < theme.tex.length; i++) {
      const variantIndex = i + 1;
      const tex = theme.tex[i];
      const patternCss = tex.light.join(", ");
      const deepCss = tex.deep.join(", ");

      const [existingVariant] = await sql.query(
        `SELECT id FROM theme_pattern_variants WHERE palette_id = $1 AND variant_index = $2 LIMIT 1`,
        [paletteId, variantIndex]
      );

      if (existingVariant) {
        await sql.query(`UPDATE theme_pattern_variants SET name = $1, pattern_css = $2, deep_css = $3 WHERE id = $4`, [
          tex.name,
          patternCss,
          deepCss,
          existingVariant.id,
        ]);
      } else {
        await sql.query(
          `INSERT INTO theme_pattern_variants (palette_id, variant_index, name, pattern_css, deep_css) VALUES ($1, $2, $3, $4, $5)`,
          [paletteId, variantIndex, tex.name, patternCss, deepCss]
        );
      }
    }
    console.log(`  → ${theme.tex.length} variant(s) upserted.`);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
