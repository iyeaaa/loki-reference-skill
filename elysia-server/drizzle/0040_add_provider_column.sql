-- Add email_provider_enum type and provider column to user_email_accounts
DO $$ BEGIN
    CREATE TYPE "public"."email_provider_enum" AS ENUM('sendgrid', 'nylas', 'unipile');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "user_email_accounts" ADD COLUMN IF NOT EXISTS "provider" "email_provider_enum" DEFAULT 'sendgrid' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_accounts_provider_idx" ON "user_email_accounts" USING btree ("provider");