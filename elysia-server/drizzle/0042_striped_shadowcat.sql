DROP INDEX "users_trial_active_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_start_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_end_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_trial_active";