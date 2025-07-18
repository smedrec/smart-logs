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
CREATE INDEX "alerts_resolved_by_idx" ON "alerts" USING btree ("resolved_by");