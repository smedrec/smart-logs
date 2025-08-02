CREATE TABLE "archive_dlq_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"action" varchar(255) NOT NULL,
	"failure_reason" varchar(255) NOT NULL,
	"failure_count" integer NOT NULL,
	"first_failure_time" timestamp with time zone NOT NULL,
	"last_failure_time" timestamp with time zone NOT NULL,
	"original_job_id" varchar(255),
	"original_queue_name" varchar(255),
	"original_event" jsonb NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dlq_event_timestamp_idx" ON "archive_dlq_event" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "dlq_event_action_idx" ON "archive_dlq_event" USING btree ("action");--> statement-breakpoint
CREATE INDEX "dlq_event_failure_reason_idx" ON "archive_dlq_event" USING btree ("failure_reason");--> statement-breakpoint
CREATE INDEX "dlq_event_failure_count_idx" ON "archive_dlq_event" USING btree ("failure_count");--> statement-breakpoint
CREATE INDEX "dlq_event_first_failure_time_idx" ON "archive_dlq_event" USING btree ("first_failure_time");--> statement-breakpoint
CREATE INDEX "dlq_event_last_failure_time_idx" ON "archive_dlq_event" USING btree ("last_failure_time");--> statement-breakpoint
CREATE INDEX "dlq_event_original_job_id_idx" ON "archive_dlq_event" USING btree ("original_job_id");--> statement-breakpoint
CREATE INDEX "dlq_event_original_queue_name_idx" ON "archive_dlq_event" USING btree ("original_queue_name");