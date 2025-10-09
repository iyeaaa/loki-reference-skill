DROP INDEX "emails_workspace_id_idx";--> statement-breakpoint
DROP INDEX "emails_user_email_account_id_idx";--> statement-breakpoint
DROP INDEX "emails_status_idx";--> statement-breakpoint
ALTER TABLE "emails" ALTER COLUMN "thread_id" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "lead_name" varchar(255);--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "lead_email" varchar(255);--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "sequence_name" varchar(255);--> statement-breakpoint
CREATE INDEX "emails_workspace_user_idx" ON "emails" USING btree ("workspace_id","user_email_account_id");--> statement-breakpoint
CREATE INDEX "emails_status_direction_idx" ON "emails" USING btree ("status","direction");