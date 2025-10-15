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
CREATE INDEX "download_links_expired_cleanup_idx" ON "download_links" USING btree ("expires_at","is_active");