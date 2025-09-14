CREATE TABLE "pseudonym_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"pseudonym_id" text NOT NULL,
	"original_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pseudonym_mapping_timestamp_idx" ON "pseudonym_mapping" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "pseudonym_mapping_pseudonym_id_idx" ON "pseudonym_mapping" USING btree ("pseudonym_id");--> statement-breakpoint
CREATE INDEX "pseudonym_mapping_original_id_idx" ON "pseudonym_mapping" USING btree ("original_id");