CREATE TYPE "public"."auth_provider_enum" AS ENUM('local', 'google');--> statement-breakpoint
ALTER TYPE "public"."user_role_enum" ADD VALUE 'super_admin' BEFORE 'admin';--> statement-breakpoint
ALTER TYPE "public"."user_role_enum" ADD VALUE 'paying_user' BEFORE 'user';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" "auth_provider_enum" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oauth_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_picture" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_end_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_trial_active" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "users_auth_provider_idx" ON "users" USING btree ("auth_provider");--> statement-breakpoint
CREATE INDEX "users_oauth_id_idx" ON "users" USING btree ("oauth_id");--> statement-breakpoint
CREATE INDEX "users_trial_active_idx" ON "users" USING btree ("is_trial_active");