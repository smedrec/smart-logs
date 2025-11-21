CREATE TABLE "alerts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"source" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"correlation_id" varchar(255),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"acknowledged" varchar(10) DEFAULT 'false' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(255),
	"resolved" varchar(10) DEFAULT 'false' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(255),
	"resolution_notes" text,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "archive_storage" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retrieved_count" integer DEFAULT 0 NOT NULL,
	"last_retrieved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_integrity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_log_id" integer NOT NULL,
	"verification_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"verification_status" varchar(20) NOT NULL,
	"verification_details" jsonb,
	"verified_by" varchar(255),
	"hash_verified" varchar(64),
	"expected_hash" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"ttl" varchar(255),
	"principal_id" varchar(255),
	"organization_id" varchar(255),
	"action" varchar(255) NOT NULL,
	"target_resource_type" varchar(255),
	"target_resource_id" varchar(255),
	"status" varchar(50) NOT NULL,
	"outcome_description" text,
	"hash" varchar(64),
	"hash_algorithm" varchar(50) DEFAULT 'SHA-256',
	"event_version" varchar(20) DEFAULT '1.0',
	"correlation_id" varchar(255),
	"data_classification" varchar(20) DEFAULT 'INTERNAL',
	"retention_policy" varchar(50) DEFAULT 'standard',
	"processing_latency" integer,
	"archived_at" timestamp with time zone,
	"details" jsonb
) PARTITION BY RANGE (timestamp);
--> statement-breakpoint
CREATE TABLE "audit_preset" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" varchar(255) NOT NULL,
	"action" varchar(255) NOT NULL,
	"data_classification" varchar(20) NOT NULL,
	"required_fields" jsonb,
	"default_values" jsonb NOT NULL,
	"validation" jsonb DEFAULT '{"maxStringLength":10000,"allowedDataClassifications":["PUBLIC","INTERNAL","CONFIDENTIAL","PHI"],"requiredFields":["timestamp","action","status"],"maxCustomFieldDepth":3,"allowedEventVersions":["1.0","1.1","2.0"]}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "audit_retention_policy" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_name" varchar(100) NOT NULL,
	"retention_days" integer NOT NULL,
	"archive_after_days" integer,
	"delete_after_days" integer,
	"data_classification" varchar(20) NOT NULL,
	"description" text,
	"is_active" varchar(10) DEFAULT 'true',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "audit_retention_policy_policy_name_unique" UNIQUE("policy_name")
);
--> statement-breakpoint
CREATE TABLE "config_change_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"field" varchar(255) NOT NULL,
	"previous_value" jsonb NOT NULL,
	"new_value" jsonb NOT NULL,
	"changed_by" varchar(255) NOT NULL,
	"reason" varchar(255),
	"environment" varchar(255) NOT NULL,
	"previous_version" varchar(255),
	"new_version" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "delivery_destinations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(255),
	"instructions" text,
	"is_default" varchar(10) DEFAULT 'false' NOT NULL,
	"disabled" varchar(10) DEFAULT 'false' NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_by" varchar(255),
	"count_usage" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_id" varchar(255) NOT NULL,
	"destinations" jsonb DEFAULT '[]' NOT NULL,
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
CREATE TABLE "download_links" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"delivery_id" varchar(255),
	"object_id" varchar(255) NOT NULL,
	"object_type" varchar(50) NOT NULL,
	"object_metadata" jsonb NOT NULL,
	"file_path" varchar(1000) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer,
	"signed_url" text NOT NULL,
	"signature" varchar(255) NOT NULL,
	"algorithm" varchar(50) DEFAULT 'HMAC-SHA256' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"max_access" integer,
	"accessed_by" jsonb DEFAULT '[]' NOT NULL,
	"is_active" varchar(10) DEFAULT 'true' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar(255),
	"revoked_reason" text,
	"created_by" varchar(255),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_aggregation" (
	"aggregation_key" varchar(255) PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"error_rate" varchar(20) DEFAULT '0' NOT NULL,
	"trend" varchar(20) DEFAULT 'STABLE' NOT NULL,
	"first_occurrence" timestamp with time zone NOT NULL,
	"last_occurrence" timestamp with time zone NOT NULL,
	"affected_components" jsonb DEFAULT '[]' NOT NULL,
	"affected_users" jsonb DEFAULT '[]' NOT NULL,
	"samples" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_log" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"code" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"component" varchar(100) NOT NULL,
	"operation" varchar(100) NOT NULL,
	"correlation_id" varchar(255) NOT NULL,
	"user_id" varchar(255),
	"session_id" varchar(255),
	"request_id" varchar(255),
	"retryable" varchar(10) NOT NULL,
	"aggregation_key" varchar(255) NOT NULL,
	"context" jsonb,
	"troubleshooting" jsonb,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_configs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255),
	"config" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "pseudonym_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"pseudonym_id" text NOT NULL,
	"original_id" text NOT NULL,
	"strategy" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_executions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"scheduled_report_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"run_id" varchar(255) NOT NULL,
	"scheduled_time" timestamp with time zone NOT NULL,
	"execution_time" timestamp with time zone NOT NULL,
	"status" varchar(20) NOT NULL,
	"trigger" varchar(20) NOT NULL,
	"duration" integer,
	"records_processed" integer,
	"export_result" jsonb,
	"integrity_report" jsonb,
	"delivery_id" varchar(255),
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"is_public" varchar(10) DEFAULT 'false' NOT NULL,
	"report_type" varchar(100) NOT NULL,
	"default_format" varchar(50) NOT NULL,
	"default_criteria" jsonb,
	"default_export_config" jsonb,
	"default_delivery_config" jsonb,
	"default_notifications_config" jsonb,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"is_active" varchar(10) DEFAULT 'true' NOT NULL,
	"is_default" varchar(10) DEFAULT 'false' NOT NULL,
	"configuration" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "scheduled_reports" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" varchar(255) NOT NULL,
	"template_id" varchar(255),
	"report_type" varchar(50) NOT NULL,
	"criteria" jsonb NOT NULL,
	"format" varchar(50) NOT NULL,
	"schedule" jsonb NOT NULL,
	"delivery" jsonb NOT NULL,
	"export" jsonb NOT NULL,
	"notification" jsonb NOT NULL,
	"enabled" varchar(10) DEFAULT 'true' NOT NULL,
	"last_run" timestamp with time zone,
	"next_run" timestamp with time zone,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"run_id" varchar(255),
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" varchar(10) DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
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
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_scheduled_report_id_scheduled_reports_id_fk" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "alerts_updated_at_idx" ON "alerts" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "alerts_acknowledged_at_idx" ON "alerts" USING btree ("acknowledged_at");--> statement-breakpoint
CREATE INDEX "alerts_resolved_at_idx" ON "alerts" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_type_idx" ON "alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alerts_source_idx" ON "alerts" USING btree ("source");--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_correlation_id_idx" ON "alerts" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "alerts_organization_id_idx" ON "alerts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "alerts_organization_acknowledged_idx" ON "alerts" USING btree ("organization_id","acknowledged");--> statement-breakpoint
CREATE INDEX "alerts_organization_resolved_idx" ON "alerts" USING btree ("organization_id","resolved");--> statement-breakpoint
CREATE INDEX "alerts_organization_severity_idx" ON "alerts" USING btree ("organization_id","severity");--> statement-breakpoint
CREATE INDEX "alerts_organization_type_idx" ON "alerts" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "alerts_organization_source_idx" ON "alerts" USING btree ("organization_id","source");--> statement-breakpoint
CREATE INDEX "alerts_organization_status_idx" ON "alerts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "alerts_organization_created_idx" ON "alerts" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "alerts_organization_updated_idx" ON "alerts" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "alerts_organization_correlation_id_idx" ON "alerts" USING btree ("organization_id","correlation_id");--> statement-breakpoint
CREATE INDEX "alerts_metadata_idx" ON "alerts" USING btree (("metadata"));--> statement-breakpoint
CREATE INDEX "alerts_org_created_status_idx" ON "alerts" USING btree ("organization_id","created_at","status");--> statement-breakpoint
CREATE INDEX "alerts_org_created_acknowledged_idx" ON "alerts" USING btree ("organization_id","created_at","acknowledged");--> statement-breakpoint
CREATE INDEX "alerts_org_created_resolved_idx" ON "alerts" USING btree ("organization_id","created_at","resolved");--> statement-breakpoint
CREATE INDEX "alerts_org_severity_created_idx" ON "alerts" USING btree ("organization_id","severity","created_at");--> statement-breakpoint
CREATE INDEX "alerts_resolved_by_idx" ON "alerts" USING btree ("resolved_by");--> statement-breakpoint
CREATE INDEX "dlq_event_timestamp_idx" ON "archive_dlq_event" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "dlq_event_action_idx" ON "archive_dlq_event" USING btree ("action");--> statement-breakpoint
CREATE INDEX "dlq_event_failure_reason_idx" ON "archive_dlq_event" USING btree ("failure_reason");--> statement-breakpoint
CREATE INDEX "dlq_event_failure_count_idx" ON "archive_dlq_event" USING btree ("failure_count");--> statement-breakpoint
CREATE INDEX "dlq_event_first_failure_time_idx" ON "archive_dlq_event" USING btree ("first_failure_time");--> statement-breakpoint
CREATE INDEX "dlq_event_last_failure_time_idx" ON "archive_dlq_event" USING btree ("last_failure_time");--> statement-breakpoint
CREATE INDEX "dlq_event_original_job_id_idx" ON "archive_dlq_event" USING btree ("original_job_id");--> statement-breakpoint
CREATE INDEX "dlq_event_original_queue_name_idx" ON "archive_dlq_event" USING btree ("original_queue_name");--> statement-breakpoint
CREATE INDEX "archive_storage_created_at_idx" ON "archive_storage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "archive_storage_retrieved_count_idx" ON "archive_storage" USING btree ("retrieved_count");--> statement-breakpoint
CREATE INDEX "archive_storage_last_retrieved_at_idx" ON "archive_storage" USING btree ("last_retrieved_at");--> statement-breakpoint
CREATE INDEX "archive_storage_retention_policy_idx" ON "archive_storage" USING btree (("metadata"->>'retentionPolicy'));--> statement-breakpoint
CREATE INDEX "archive_storage_data_classification_idx" ON "archive_storage" USING btree (("metadata"->>'dataClassification'));--> statement-breakpoint
CREATE INDEX "archive_storage_date_range_start_idx" ON "archive_storage" USING btree ((("metadata"->>'dateRange')::jsonb->>'start'));--> statement-breakpoint
CREATE INDEX "archive_storage_date_range_end_idx" ON "archive_storage" USING btree ((("metadata"->>'dateRange')::jsonb->>'end'));--> statement-breakpoint
CREATE INDEX "audit_integrity_log_audit_log_id_idx" ON "audit_integrity_log" USING btree ("audit_log_id");--> statement-breakpoint
CREATE INDEX "audit_integrity_log_verification_timestamp_idx" ON "audit_integrity_log" USING btree ("verification_timestamp");--> statement-breakpoint
CREATE INDEX "audit_integrity_log_verification_status_idx" ON "audit_integrity_log" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "audit_integrity_log_verified_by_idx" ON "audit_integrity_log" USING btree ("verified_by");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_principal_id_idx" ON "audit_log" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_status_idx" ON "audit_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_log_hash_idx" ON "audit_log" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "audit_log_target_resource_type_idx" ON "audit_log" USING btree ("target_resource_type");--> statement-breakpoint
CREATE INDEX "audit_log_target_resource_id_idx" ON "audit_log" USING btree ("target_resource_id");--> statement-breakpoint
CREATE INDEX "audit_log_correlation_id_idx" ON "audit_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "audit_log_data_classification_idx" ON "audit_log" USING btree ("data_classification");--> statement-breakpoint
CREATE INDEX "audit_log_retention_policy_idx" ON "audit_log" USING btree ("retention_policy");--> statement-breakpoint
CREATE INDEX "audit_log_archived_at_idx" ON "audit_log" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_status_idx" ON "audit_log" USING btree ("timestamp","status");--> statement-breakpoint
CREATE INDEX "audit_log_principal_action_idx" ON "audit_log" USING btree ("principal_id","action");--> statement-breakpoint
CREATE INDEX "audit_log_classification_retention_idx" ON "audit_log" USING btree ("data_classification","retention_policy");--> statement-breakpoint
CREATE INDEX "audit_log_resource_type_id_idx" ON "audit_log" USING btree ("target_resource_type","target_resource_id");--> statement-breakpoint
CREATE INDEX "audit_preset_name_idx" ON "audit_preset" USING btree ("name");--> statement-breakpoint
CREATE INDEX "audit_preset_organization_id_idx" ON "audit_preset" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_preset_data_classification_idx" ON "audit_preset" USING btree ("data_classification");--> statement-breakpoint
CREATE INDEX "audit_preset_created_at_idx" ON "audit_preset" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_preset_updated_at_idx" ON "audit_preset" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "audit_preset_created_by_idx" ON "audit_preset" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "audit_preset_updated_by_idx" ON "audit_preset" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_preset_name_org_unique" ON "audit_preset" USING btree ("name","organization_id");--> statement-breakpoint
CREATE INDEX "audit_retention_policy_policy_name_idx" ON "audit_retention_policy" USING btree ("policy_name");--> statement-breakpoint
CREATE INDEX "audit_retention_policy_data_classification_idx" ON "audit_retention_policy" USING btree ("data_classification");--> statement-breakpoint
CREATE INDEX "audit_retention_policy_is_active_idx" ON "audit_retention_policy" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "audit_retention_policy_created_at_idx" ON "audit_retention_policy" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "config_change_event_timestamp_idx" ON "config_change_event" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "config_change_event_field_idx" ON "config_change_event" USING btree ("field");--> statement-breakpoint
CREATE INDEX "config_change_event_changed_by_idx" ON "config_change_event" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "config_change_event_environment_idx" ON "config_change_event" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "config_change_event_previous_version_idx" ON "config_change_event" USING btree ("previous_version");--> statement-breakpoint
CREATE INDEX "config_change_event_new_version_idx" ON "config_change_event" USING btree ("new_version");--> statement-breakpoint
CREATE INDEX "delivery_destinations_type_idx" ON "delivery_destinations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "delivery_destinations_organization_id_idx" ON "delivery_destinations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delivery_destinations_disabled_idx" ON "delivery_destinations" USING btree ("disabled");--> statement-breakpoint
CREATE INDEX "delivery_destinations_last_used_at_idx" ON "delivery_destinations" USING btree ("last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_destinations_org_label_unique" ON "delivery_destinations" USING btree ("organization_id","label");--> statement-breakpoint
CREATE INDEX "delivery_destinations_created_at_idx" ON "delivery_destinations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "delivery_destinations_updated_at_idx" ON "delivery_destinations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "delivery_logs_delivery_id_idx" ON "delivery_logs" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "delivery_logs_destinations_idx" ON "delivery_logs" USING btree ("destinations");--> statement-breakpoint
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
CREATE INDEX "delivery_logs_destinations_status_idx" ON "delivery_logs" USING btree ("destinations","status");--> statement-breakpoint
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
CREATE INDEX "download_links_organization_id_idx" ON "download_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "download_links_delivery_id_idx" ON "download_links" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "download_links_object_id_idx" ON "download_links" USING btree ("object_id");--> statement-breakpoint
CREATE INDEX "download_links_object_type_idx" ON "download_links" USING btree ("object_type");--> statement-breakpoint
CREATE INDEX "download_links_expires_at_idx" ON "download_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "download_links_is_active_idx" ON "download_links" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "download_links_access_count_idx" ON "download_links" USING btree ("access_count");--> statement-breakpoint
CREATE INDEX "download_links_created_at_idx" ON "download_links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "download_links_created_by_idx" ON "download_links" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "download_links_revoked_at_idx" ON "download_links" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "download_links_org_active_idx" ON "download_links" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "download_links_org_expires_idx" ON "download_links" USING btree ("organization_id","expires_at");--> statement-breakpoint
CREATE INDEX "download_links_active_expires_idx" ON "download_links" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE INDEX "download_links_object_active_idx" ON "download_links" USING btree ("object_id","is_active");--> statement-breakpoint
CREATE INDEX "download_links_org_object_type_idx" ON "download_links" USING btree ("organization_id","object_type");--> statement-breakpoint
CREATE INDEX "download_links_expired_cleanup_idx" ON "download_links" USING btree ("expires_at","is_active");--> statement-breakpoint
CREATE INDEX "error_aggregation_category_idx" ON "error_aggregation" USING btree ("category");--> statement-breakpoint
CREATE INDEX "error_aggregation_severity_idx" ON "error_aggregation" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "error_aggregation_count_idx" ON "error_aggregation" USING btree ("count");--> statement-breakpoint
CREATE INDEX "error_aggregation_trend_idx" ON "error_aggregation" USING btree ("trend");--> statement-breakpoint
CREATE INDEX "error_aggregation_first_occurrence_idx" ON "error_aggregation" USING btree ("first_occurrence");--> statement-breakpoint
CREATE INDEX "error_aggregation_last_occurrence_idx" ON "error_aggregation" USING btree ("last_occurrence");--> statement-breakpoint
CREATE INDEX "error_aggregation_updated_at_idx" ON "error_aggregation" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "error_aggregation_category_count_idx" ON "error_aggregation" USING btree ("category","count");--> statement-breakpoint
CREATE INDEX "error_aggregation_severity_count_idx" ON "error_aggregation" USING btree ("severity","count");--> statement-breakpoint
CREATE INDEX "error_log_timestamp_idx" ON "error_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "error_log_category_idx" ON "error_log" USING btree ("category");--> statement-breakpoint
CREATE INDEX "error_log_severity_idx" ON "error_log" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "error_log_component_idx" ON "error_log" USING btree ("component");--> statement-breakpoint
CREATE INDEX "error_log_correlation_id_idx" ON "error_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "error_log_aggregation_key_idx" ON "error_log" USING btree ("aggregation_key");--> statement-breakpoint
CREATE INDEX "error_log_user_id_idx" ON "error_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "error_log_created_at_idx" ON "error_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "error_log_category_severity_idx" ON "error_log" USING btree ("category","severity");--> statement-breakpoint
CREATE INDEX "error_log_component_timestamp_idx" ON "error_log" USING btree ("component","timestamp");--> statement-breakpoint
CREATE INDEX "organization_configs_organization_id_idx" ON "organization_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_configs_created_at_idx" ON "organization_configs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organization_configs_updated_at_idx" ON "organization_configs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "pseudonym_mapping_timestamp_idx" ON "pseudonym_mapping" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "pseudonym_mapping_pseudonym_id_idx" ON "pseudonym_mapping" USING btree ("pseudonym_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pseudonym_mapping_original_id_idx" ON "pseudonym_mapping" USING btree ("original_id");--> statement-breakpoint
CREATE INDEX "pseudonym_mapping_strategy_idx" ON "pseudonym_mapping" USING btree ("strategy");--> statement-breakpoint
CREATE INDEX "report_executions_scheduled_report_id_idx" ON "report_executions" USING btree ("scheduled_report_id");--> statement-breakpoint
CREATE INDEX "report_executions_organization_id_idx" ON "report_executions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "report_executions_status_idx" ON "report_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_executions_trigger_idx" ON "report_executions" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "report_executions_scheduled_time_idx" ON "report_executions" USING btree ("scheduled_time");--> statement-breakpoint
CREATE INDEX "report_executions_execution_time_idx" ON "report_executions" USING btree ("execution_time");--> statement-breakpoint
CREATE INDEX "report_executions_delivery_id_idx" ON "report_executions" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "report_executions_created_at_idx" ON "report_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_executions_org_status_idx" ON "report_executions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "report_executions_org_trigger_idx" ON "report_executions" USING btree ("organization_id","trigger");--> statement-breakpoint
CREATE INDEX "report_executions_config_execution_time_idx" ON "report_executions" USING btree ("scheduled_report_id","execution_time");--> statement-breakpoint
CREATE INDEX "report_executions_org_execution_time_idx" ON "report_executions" USING btree ("organization_id","execution_time");--> statement-breakpoint
CREATE INDEX "report_templates_organization_id_idx" ON "report_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "report_templates_category_idx" ON "report_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "report_templates_is_public_idx" ON "report_templates" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "report_templates_is_default_default_idx" ON "report_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "report_templates_report_type_idx" ON "report_templates" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "report_templates_is_active_idx" ON "report_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "report_templates_created_at_idx" ON "report_templates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_templates_created_by_idx" ON "report_templates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "report_templates_name_idx" ON "report_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "report_templates_org_public_idx" ON "report_templates" USING btree ("organization_id","is_public");--> statement-breakpoint
CREATE INDEX "report_templates_org_active_idx" ON "report_templates" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "report_templates_org_default_idx" ON "report_templates" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "report_templates_org_type_idx" ON "report_templates" USING btree ("organization_id","report_type");--> statement-breakpoint
CREATE INDEX "report_templates_active_type_idx" ON "report_templates" USING btree ("is_active","report_type");--> statement-breakpoint
CREATE INDEX "report_templates_tags_idx" ON "report_templates" USING btree (("tags"));--> statement-breakpoint
CREATE INDEX "scheduled_reports_organization_id_idx" ON "scheduled_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scheduled_reports_template_id_idx" ON "scheduled_reports" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "scheduled_reports_enabled_idx" ON "scheduled_reports" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "scheduled_reports_next_run_idx" ON "scheduled_reports" USING btree ("next_run");--> statement-breakpoint
CREATE INDEX "scheduled_reports_created_at_idx" ON "scheduled_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scheduled_reports_created_by_idx" ON "scheduled_reports" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "scheduled_reports_org_enabled_idx" ON "scheduled_reports" USING btree ("organization_id","enabled");--> statement-breakpoint
CREATE INDEX "scheduled_reports_org_next_run_idx" ON "scheduled_reports" USING btree ("organization_id","next_run");--> statement-breakpoint
CREATE INDEX "scheduled_reports_enabled_next_run_idx" ON "scheduled_reports" USING btree ("enabled","next_run");--> statement-breakpoint
CREATE INDEX "webhook_secrets_destination_id_idx" ON "webhook_secrets" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "webhook_secrets_is_active_idx" ON "webhook_secrets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "webhook_secrets_is_primary_idx" ON "webhook_secrets" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "webhook_secrets_expires_at_idx" ON "webhook_secrets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "webhook_secrets_created_at_idx" ON "webhook_secrets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_secrets_last_used_at_idx" ON "webhook_secrets" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "webhook_secrets_destination_active_idx" ON "webhook_secrets" USING btree ("destination_id","is_active");--> statement-breakpoint
CREATE INDEX "webhook_secrets_destination_primary_idx" ON "webhook_secrets" USING btree ("destination_id","is_primary");