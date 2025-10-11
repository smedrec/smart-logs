CREATE TABLE "delivery_destinations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(255),
	"instructions" text,
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
CREATE INDEX "delivery_destinations_type_idx" ON "delivery_destinations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "delivery_destinations_organization_id_idx" ON "delivery_destinations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delivery_destinations_disabled_idx" ON "delivery_destinations" USING btree ("disabled");--> statement-breakpoint
CREATE INDEX "delivery_destinations_last_used_at_idx" ON "delivery_destinations" USING btree ("last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_destinations_org_label_unique" ON "delivery_destinations" USING btree ("organization_id","label");--> statement-breakpoint
CREATE INDEX "delivery_destinations_created_at_idx" ON "delivery_destinations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "delivery_destinations_updated_at_idx" ON "delivery_destinations" USING btree ("updated_at");