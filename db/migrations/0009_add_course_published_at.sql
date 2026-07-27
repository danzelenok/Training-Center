ALTER TABLE "courses" ADD COLUMN "published_at" timestamp;
--> statement-breakpoint
UPDATE "courses" SET "published_at" = "created_at" WHERE "status" = 'published' AND "published_at" IS NULL;