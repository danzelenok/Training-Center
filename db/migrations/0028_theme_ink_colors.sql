-- Temporary '' default so ADD COLUMN ... NOT NULL succeeds against the 5
-- existing rows without deleting anything (same technique as 0027, and for
-- the same reason: courses.theme_palette_id/theme_variant_id may already
-- reference these rows). Overwritten immediately after by re-running
-- scripts/seed-theme-palettes.ts.
ALTER TABLE "theme_palettes" ADD COLUMN "deep_ink" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "deep_muted" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "light_ink" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "light_muted" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "theme_palettes" ADD COLUMN "line_color" text NOT NULL DEFAULT '';
