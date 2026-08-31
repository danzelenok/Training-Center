-- Adds Theme System v2's typography/accent identity + dual (deep/light)
-- backgrounds to the 5 existing palettes / 25 existing variants.
--
-- No DELETE/TRUNCATE here (an earlier version of this migration used
-- TRUNCATE, then DELETE, to clear these tables before adding the new NOT
-- NULL columns — both were wrong): at least one real course
-- (c5ed73e0-e254-4565-9a88-3d0bed59c92a, "test") now has
-- theme_palette_id/theme_variant_id pointing at these rows via FK, picked
-- through the live "Style Course" UI. Removing rows here would either be
-- rejected by Postgres (TRUNCATE refuses when referenced by another
-- table's FK; DELETE is rejected per-row once a real reference exists) or,
-- if forced via CASCADE, would silently orphan that course's theme choice.
--
-- Instead: widen the columns with a temporary '' / false placeholder
-- default so the NOT NULL constraint can be satisfied on the 5/25 existing
-- rows without touching their ids, then IMMEDIATELY run
-- scripts/seed-theme-palettes.ts — its UPDATE-by-name/variant_index path
-- overwrites every existing row with real values in place. Any row/course
-- reference stays valid throughout; nothing is ever removed or recreated.
ALTER TABLE "theme_palettes" ADD COLUMN "font_family" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "display_font_family" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "font_weight" integer DEFAULT 700 NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "letter_spacing" text DEFAULT '-0.02em' NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "card_radius" integer DEFAULT 22 NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "accent_color" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "accent_ink_color" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "is_dark" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_pattern_variants" ADD COLUMN "name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_pattern_variants" ADD COLUMN "deep_css" text NOT NULL DEFAULT '';
