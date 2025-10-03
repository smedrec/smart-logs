ALTER TABLE "alerts" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_organization_source_idx" ON "alerts" USING btree ("organization_id","source");--> statement-breakpoint
CREATE INDEX "alerts_organization_status_idx" ON "alerts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "alerts_organization_created_idx" ON "alerts" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "alerts_organization_updated_idx" ON "alerts" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "alerts_organization_correlation_id_idx" ON "alerts" USING btree ("organization_id","correlation_id");--> statement-breakpoint
CREATE INDEX "alerts_metadata_idx" ON "alerts" USING btree (("metadata"));--> statement-breakpoint
CREATE INDEX "alerts_org_created_status_idx" ON "alerts" USING btree ("organization_id","created_at","status");--> statement-breakpoint
CREATE INDEX "alerts_org_created_acknowledged_idx" ON "alerts" USING btree ("organization_id","created_at","acknowledged");