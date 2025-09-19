ALTER TABLE "pseudonym_mapping" ADD COLUMN "strategy" varchar(20) NOT NULL;--> statement-breakpoint
CREATE INDEX "pseudonym_mapping_strategy_idx" ON "pseudonym_mapping" USING btree ("strategy");