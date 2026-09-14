ALTER TABLE "assignments" DROP CONSTRAINT "assignments_worker_id_course_id_unique";--> statement-breakpoint
ALTER TABLE "progress" DROP CONSTRAINT "progress_worker_id_course_id_unique";--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ALTER COLUMN "run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_worker_id_run_id_unique" UNIQUE("worker_id","run_id");--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_worker_id_run_id_unique" UNIQUE("worker_id","run_id");