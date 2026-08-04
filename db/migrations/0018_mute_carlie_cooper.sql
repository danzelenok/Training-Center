CREATE TABLE "course_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"jurisdiction_id" uuid,
	"source_url" text NOT NULL,
	"retrieved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_sources_course_id_jurisdiction_id_unique" UNIQUE("course_id","jurisdiction_id")
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"regulator_name" text NOT NULL,
	"base_source_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "jurisdictions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "organization_jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	CONSTRAINT "organization_jurisdictions_organization_id_jurisdiction_id_unique" UNIQUE("organization_id","jurisdiction_id")
);
--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "jurisdiction_id" uuid;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "jurisdiction_id" uuid;--> statement-breakpoint
ALTER TABLE "course_sources" ADD CONSTRAINT "course_sources_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sources" ADD CONSTRAINT "course_sources_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_jurisdictions" ADD CONSTRAINT "organization_jurisdictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_jurisdictions" ADD CONSTRAINT "organization_jurisdictions_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;