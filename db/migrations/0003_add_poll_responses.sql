CREATE TABLE "poll_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"slide_index" integer NOT NULL,
	"rating" text,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;