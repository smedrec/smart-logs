ALTER TABLE "report_executions" ADD COLUMN "integrity_report" jsonb;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "export" jsonb NOT NULL;