ALTER TABLE "report_templates" ALTER COLUMN "default_criteria" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "report_templates" ALTER COLUMN "default_export_config" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "category" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "is_public" varchar(10) DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "default_delivery_config" jsonb;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "default_notifications_config" jsonb;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "is_default" varchar(10) DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "configuration" jsonb;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "report_templates" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "report_templates_category_idx" ON "report_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "report_templates_is_public_idx" ON "report_templates" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "report_templates_is_default_default_idx" ON "report_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "report_templates_org_public_idx" ON "report_templates" USING btree ("organization_id","is_public");--> statement-breakpoint
CREATE INDEX "report_templates_org_default_idx" ON "report_templates" USING btree ("organization_id","is_default");