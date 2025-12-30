ALTER TYPE "public"."subscription_status_enum" ADD VALUE 'expired';--> statement-breakpoint
ALTER TYPE "public"."step_execution_status_enum" ADD VALUE 'processing' BEFORE 'scheduled';--> statement-breakpoint
DROP INDEX "users_trial_active_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_start_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_end_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_trial_active";