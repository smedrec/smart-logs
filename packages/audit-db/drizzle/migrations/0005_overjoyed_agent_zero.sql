CREATE TABLE "audit_preset" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" varchar(255) NOT NULL,
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
CREATE INDEX "audit_preset_name_idx" ON "audit_preset" USING btree ("name");--> statement-breakpoint
CREATE INDEX "audit_preset_organization_id_idx" ON "audit_preset" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_preset_data_classification_idx" ON "audit_preset" USING btree ("data_classification");--> statement-breakpoint
CREATE INDEX "audit_preset_created_at_idx" ON "audit_preset" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_preset_updated_at_idx" ON "audit_preset" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "audit_preset_created_by_idx" ON "audit_preset" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "audit_preset_updated_by_idx" ON "audit_preset" USING btree ("updated_by");