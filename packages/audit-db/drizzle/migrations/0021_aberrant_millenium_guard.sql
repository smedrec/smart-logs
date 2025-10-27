ALTER TABLE "report_executions" ADD COLUMN "delivery_id" varchar(255);--> statement-breakpoint
CREATE INDEX "report_executions_delivery_id_idx" ON "report_executions" USING btree ("delivery_id");--> statement-breakpoint
ALTER TABLE "report_executions" DROP COLUMN "delivery_attempts";