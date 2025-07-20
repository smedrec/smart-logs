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
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_report_config_id_scheduled_reports_id_fk" FOREIGN KEY ("report_config_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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