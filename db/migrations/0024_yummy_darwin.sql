CREATE TABLE "course_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_roles_course_id_role_id_unique" UNIQUE("course_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_role_id_job_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_role_id_job_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "role_id";