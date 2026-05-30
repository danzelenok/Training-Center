ALTER TABLE "courses" ADD COLUMN "generation_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "asset_status" text DEFAULT 'ready' NOT NULL;