CREATE TABLE "alerts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"source" varchar(100) NOT NULL,
	"correlation_id" varchar(255),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"resolved" varchar(10) DEFAULT 'false' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(255),
	"resolution_notes" text,
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
);
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
CREATE TABLE "report_executions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"report_config_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"scheduled_time" timestamp with time zone NOT NULL,
	"execution_time" timestamp with time zone NOT NULL,
	"status" varchar(20) NOT NULL,
	"duration" integer,
	"records_processed" integer,
	"export_result" jsonb,
	"delivery_attempts" jsonb DEFAULT '[]' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" varchar(255) NOT NULL,
	"report_type" varchar(100) NOT NULL,
	"default_criteria" jsonb NOT NULL,
	"default_format" varchar(50) NOT NULL,
	"default_export_config" jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"is_active" varchar(10) DEFAULT 'true' NOT NULL,
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
	"criteria" jsonb NOT NULL,
	"format" varchar(50) NOT NULL,
	"schedule" jsonb NOT NULL,
	"delivery" jsonb NOT NULL,
	"enabled" varchar(10) DEFAULT 'true' NOT NULL,
	"last_run" timestamp with time zone,
	"next_run" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "audit_integrity_log" ADD CONSTRAINT "audit_integrity_log_audit_log_id_audit_log_id_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_report_config_id_scheduled_reports_id_fk" FOREIGN KEY ("report_config_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_organization_id_idx" ON "alerts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "alerts_organization_resolved_idx" ON "alerts" USING btree ("organization_id","resolved");--> statement-breakpoint
CREATE INDEX "alerts_organization_severity_idx" ON "alerts" USING btree ("organization_id","severity");--> statement-breakpoint
CREATE INDEX "alerts_organization_type_idx" ON "alerts" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "alerts_updated_at_idx" ON "alerts" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "alerts_resolved_at_idx" ON "alerts" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_type_idx" ON "alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alerts_source_idx" ON "alerts" USING btree ("source");--> statement-breakpoint
CREATE INDEX "alerts_correlation_id_idx" ON "alerts" USING btree ("correlation_id");--> statement-breakpoint
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
CREATE INDEX "report_executions_report_config_id_idx" ON "report_executions" USING btree ("report_config_id");--> statement-breakpoint
CREATE INDEX "report_executions_organization_id_idx" ON "report_executions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "report_executions_status_idx" ON "report_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_executions_scheduled_time_idx" ON "report_executions" USING btree ("scheduled_time");--> statement-breakpoint
CREATE INDEX "report_executions_execution_time_idx" ON "report_executions" USING btree ("execution_time");--> statement-breakpoint
CREATE INDEX "report_executions_created_at_idx" ON "report_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_executions_org_status_idx" ON "report_executions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "report_executions_config_execution_time_idx" ON "report_executions" USING btree ("report_config_id","execution_time");--> statement-breakpoint
CREATE INDEX "report_executions_org_execution_time_idx" ON "report_executions" USING btree ("organization_id","execution_time");--> statement-breakpoint
CREATE INDEX "report_templates_organization_id_idx" ON "report_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "report_templates_report_type_idx" ON "report_templates" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "report_templates_is_active_idx" ON "report_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "report_templates_created_at_idx" ON "report_templates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_templates_created_by_idx" ON "report_templates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "report_templates_name_idx" ON "report_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "report_templates_org_active_idx" ON "report_templates" USING btree ("organization_id","is_active");--> statement-breakpoint
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
CREATE INDEX "scheduled_reports_enabled_next_run_idx" ON "scheduled_reports" USING btree ("enabled","next_run");