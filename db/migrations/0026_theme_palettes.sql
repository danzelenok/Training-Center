CREATE TABLE "theme_palettes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_colors" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_pattern_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"palette_id" uuid NOT NULL,
	"variant_index" integer NOT NULL,
	"pattern_css" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "theme_palette_id" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "theme_variant_id" uuid;--> statement-breakpoint
ALTER TABLE "theme_pattern_variants" ADD CONSTRAINT "theme_pattern_variants_palette_id_theme_palettes_id_fk" FOREIGN KEY ("palette_id") REFERENCES "public"."theme_palettes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_theme_palette_id_theme_palettes_id_fk" FOREIGN KEY ("theme_palette_id") REFERENCES "public"."theme_palettes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_theme_variant_id_theme_pattern_variants_id_fk" FOREIGN KEY ("theme_variant_id") REFERENCES "public"."theme_pattern_variants"("id") ON DELETE no action ON UPDATE no action;