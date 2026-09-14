CREATE TABLE "course_run_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_run_id" uuid NOT NULL,
	"role_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_run_roles_course_run_id_role_name_unique" UNIQUE("course_run_id","role_name")
);
--> statement-breakpoint
CREATE TABLE "course_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"published_at" timestamp NOT NULL,
	"created_by_admin_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "course_run_roles" ADD CONSTRAINT "course_run_roles_course_run_id_course_runs_id_fk" FOREIGN KEY ("course_run_id") REFERENCES "public"."course_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_runs" ADD CONSTRAINT "course_runs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_run_id_course_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."course_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_run_id_course_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."course_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_run_id_idx" ON "assignments" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "progress_run_id_idx" ON "progress" USING btree ("run_id");