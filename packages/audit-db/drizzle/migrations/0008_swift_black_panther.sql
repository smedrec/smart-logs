DROP INDEX "pseudonym_mapping_original_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "pseudonym_mapping_original_id_idx" ON "pseudonym_mapping" USING btree ("original_id");