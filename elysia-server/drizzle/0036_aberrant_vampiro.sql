ALTER TABLE "onboarding_progress" ADD COLUMN "discovery_progress" jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD COLUMN "job_id" text;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD COLUMN "job_status" "job_status_enum";--> statement-breakpoint
CREATE INDEX "idx_onboarding_job_id" ON "onboarding_progress" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_job_status" ON "onboarding_progress" USING btree ("job_status");