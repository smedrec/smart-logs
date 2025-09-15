CREATE TABLE "organization_role" (
	"organization_id" varchar(50) NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"inherits" jsonb,
	CONSTRAINT "organization_role_organization_id_name_pk" PRIMARY KEY("organization_id","name")
);
--> statement-breakpoint
ALTER TABLE "organization_role" ADD CONSTRAINT "organization_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_role_organization_id_idx" ON "organization_role" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_role_name_idx" ON "organization_role" USING btree ("name");