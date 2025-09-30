ALTER TABLE "scheduled_reports" ADD COLUMN "execution_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "success_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "tags" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "is_deleted" varchar(10) DEFAULT 'false' NOT NULL;