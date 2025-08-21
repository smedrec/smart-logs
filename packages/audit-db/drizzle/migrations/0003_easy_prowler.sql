ALTER TABLE "alerts" ADD COLUMN "acknowledged" varchar(10) DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "acknowledged_by" varchar(255);--> statement-breakpoint
CREATE INDEX "alerts_organization_acknowledged_idx" ON "alerts" USING btree ("organization_id","acknowledged");--> statement-breakpoint
CREATE INDEX "alerts_acknowledged_at_idx" ON "alerts" USING btree ("acknowledged_at");