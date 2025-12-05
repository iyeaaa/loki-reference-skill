DO $$ BEGIN
    CREATE TYPE "public"."auth_provider_enum" AS ENUM('local', 'google');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "public"."user_role_enum" ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';--> statement-breakpoint
ALTER TYPE "public"."user_role_enum" ADD VALUE IF NOT EXISTS 'paying_user' BEFORE 'user';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" "auth_provider_enum" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oauth_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_picture" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_end_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_trial_active" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_auth_provider_idx" ON "users" USING btree ("auth_provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_oauth_id_idx" ON "users" USING btree ("oauth_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_trial_active_idx" ON "users" USING btree ("is_trial_active");