CREATE TABLE "delivery_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_id" varchar(255) NOT NULL,
	"destination_id" integer NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"object_details" jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"attempts" jsonb DEFAULT '[]' NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failure_reason" text,
	"cross_system_reference" varchar(255),
	"correlation_id" varchar(255),
	"idempotency_key" varchar(255),
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_queue" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"destination_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"correlation_id" varchar(255),
	"idempotency_key" varchar(255),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destination_health" (
	"destination_id" integer PRIMARY KEY NOT NULL,
	"status" varchar(20) NOT NULL,
	"last_check_at" timestamp with time zone NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"total_failures" integer DEFAULT 0 NOT NULL,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"success_rate" varchar(10) DEFAULT '0' NOT NULL,
	"average_response_time" integer,
	"last_failure_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"circuit_breaker_state" varchar(20) DEFAULT 'closed' NOT NULL,
	"circuit_breaker_opened_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_secrets" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"destination_id" integer NOT NULL,
	"secret_key" varchar(255) NOT NULL,
	"algorithm" varchar(50) DEFAULT 'HMAC-SHA256' NOT NULL,
	"is_active" varchar(10) DEFAULT 'true' NOT NULL,
	"is_primary" varchar(10) DEFAULT 'false' NOT NULL,
	"expires_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE INDEX "delivery_logs_delivery_id_idx" ON "delivery_logs" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "delivery_logs_destination_id_idx" ON "delivery_logs" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "delivery_logs_organization_id_idx" ON "delivery_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delivery_logs_status_idx" ON "delivery_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delivery_logs_attempts_idx" ON "delivery_logs" USING btree ("attempts");--> statement-breakpoint
CREATE INDEX "delivery_logs_last_attempt_at_idx" ON "delivery_logs" USING btree ("last_attempt_at");--> statement-breakpoint
CREATE INDEX "delivery_logs_delivered_at_idx" ON "delivery_logs" USING btree ("delivered_at");--> statement-breakpoint
CREATE INDEX "delivery_logs_cross_system_reference_idx" ON "delivery_logs" USING btree ("cross_system_reference");--> statement-breakpoint
CREATE INDEX "delivery_logs_correlation_id_idx" ON "delivery_logs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "delivery_logs_idempotency_key_idx" ON "delivery_logs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "delivery_logs_created_at_idx" ON "delivery_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "delivery_logs_updated_at_idx" ON "delivery_logs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "delivery_logs_destination_status_idx" ON "delivery_logs" USING btree ("destination_id","status");--> statement-breakpoint
CREATE INDEX "delivery_logs_status_attempts_idx" ON "delivery_logs" USING btree ("status","attempts");--> statement-breakpoint
CREATE INDEX "delivery_logs_org_status_idx" ON "delivery_logs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "delivery_logs_org_created_idx" ON "delivery_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "delivery_queue_organization_id_idx" ON "delivery_queue" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delivery_queue_destination_id_idx" ON "delivery_queue" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "delivery_queue_status_idx" ON "delivery_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delivery_queue_priority_idx" ON "delivery_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "delivery_queue_scheduled_at_idx" ON "delivery_queue" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "delivery_queue_next_retry_at_idx" ON "delivery_queue" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "delivery_queue_correlation_id_idx" ON "delivery_queue" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "delivery_queue_idempotency_key_idx" ON "delivery_queue" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "delivery_queue_created_at_idx" ON "delivery_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "delivery_queue_status_priority_idx" ON "delivery_queue" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "delivery_queue_status_scheduled_idx" ON "delivery_queue" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "delivery_queue_org_status_idx" ON "delivery_queue" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "delivery_queue_retry_scheduled_idx" ON "delivery_queue" USING btree ("next_retry_at","status");--> statement-breakpoint
CREATE INDEX "destination_health_status_idx" ON "destination_health" USING btree ("status");--> statement-breakpoint
CREATE INDEX "destination_health_last_check_at_idx" ON "destination_health" USING btree ("last_check_at");--> statement-breakpoint
CREATE INDEX "destination_health_consecutive_failures_idx" ON "destination_health" USING btree ("consecutive_failures");--> statement-breakpoint
CREATE INDEX "destination_health_success_rate_idx" ON "destination_health" USING btree ("success_rate");--> statement-breakpoint
CREATE INDEX "destination_health_circuit_breaker_state_idx" ON "destination_health" USING btree ("circuit_breaker_state");--> statement-breakpoint
CREATE INDEX "destination_health_last_failure_at_idx" ON "destination_health" USING btree ("last_failure_at");--> statement-breakpoint
CREATE INDEX "destination_health_last_success_at_idx" ON "destination_health" USING btree ("last_success_at");--> statement-breakpoint
CREATE INDEX "destination_health_disabled_at_idx" ON "destination_health" USING btree ("disabled_at");--> statement-breakpoint
CREATE INDEX "destination_health_updated_at_idx" ON "destination_health" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "webhook_secrets_destination_id_idx" ON "webhook_secrets" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "webhook_secrets_is_active_idx" ON "webhook_secrets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "webhook_secrets_is_primary_idx" ON "webhook_secrets" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "webhook_secrets_expires_at_idx" ON "webhook_secrets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "webhook_secrets_created_at_idx" ON "webhook_secrets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_secrets_last_used_at_idx" ON "webhook_secrets" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "webhook_secrets_destination_active_idx" ON "webhook_secrets" USING btree ("destination_id","is_active");--> statement-breakpoint
CREATE INDEX "webhook_secrets_destination_primary_idx" ON "webhook_secrets" USING btree ("destination_id","is_primary");