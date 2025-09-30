ALTER TABLE "report_executions" ADD COLUMN "trigger" varchar(20) NOT NULL;--> statement-breakpoint
CREATE INDEX "report_executions_trigger_idx" ON "report_executions" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "report_executions_org_trigger_idx" ON "report_executions" USING btree ("organization_id","trigger");