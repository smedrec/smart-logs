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
DROP INDEX "delivery_logs_destination_id_idx";--> statement-breakpoint
DROP INDEX "delivery_logs_destination_status_idx";--> statement-breakpoint
ALTER TABLE "delivery_destinations" ADD COLUMN "is_default" varchar(10) DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_logs" ADD COLUMN "destinations" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX "organization_configs_organization_id_idx" ON "organization_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_configs_created_at_idx" ON "organization_configs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organization_configs_updated_at_idx" ON "organization_configs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "delivery_logs_destinations_idx" ON "delivery_logs" USING btree ("destinations");--> statement-breakpoint
CREATE INDEX "delivery_logs_destinations_status_idx" ON "delivery_logs" USING btree ("destinations","status");--> statement-breakpoint
ALTER TABLE "delivery_logs" DROP COLUMN "destination_id";