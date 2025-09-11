ALTER TABLE "report_executions" ADD COLUMN "run_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "run_id" varchar(255);