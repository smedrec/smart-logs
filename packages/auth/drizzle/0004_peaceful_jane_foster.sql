CREATE TABLE "email_provider" (
	"organization_id" varchar(50) PRIMARY KEY NOT NULL,
	"provider" varchar(50) DEFAULT 'smtp' NOT NULL,
	"smtp_host" varchar(100),
	"smtp_port" integer DEFAULT 465,
	"smtp_secure" boolean DEFAULT true,
	"smtp_user" varchar(50),
	"smtp_pass" text,
	"api_key" text,
	"from_name" varchar(50),
	"from_email" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "report_config" (
	"organization_id" varchar(50) PRIMARY KEY NOT NULL,
	"delivery_method" varchar(10),
	"delivery_config" jsonb,
	"export_config" jsonb
);
--> statement-breakpoint
ALTER TABLE "email_provider" ADD CONSTRAINT "email_provider_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_config" ADD CONSTRAINT "report_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_config_delivery_method_idx" ON "report_config" USING btree ("delivery_method");