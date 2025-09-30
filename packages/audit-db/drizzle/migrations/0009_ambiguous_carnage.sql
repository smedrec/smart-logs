ALTER TABLE "report_executions" RENAME COLUMN "report_config_id" TO "scheduled_report_id";--> statement-breakpoint
ALTER TABLE "report_executions" DROP CONSTRAINT "report_executions_report_config_id_scheduled_reports_id_fk";
--> statement-breakpoint
DROP INDEX "report_executions_report_config_id_idx";--> statement-breakpoint
DROP INDEX "report_executions_config_execution_time_idx";--> statement-breakpoint
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_scheduled_report_id_scheduled_reports_id_fk" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_executions_scheduled_report_id_idx" ON "report_executions" USING btree ("scheduled_report_id");--> statement-breakpoint
CREATE INDEX "report_executions_config_execution_time_idx" ON "report_executions" USING btree ("scheduled_report_id","execution_time");