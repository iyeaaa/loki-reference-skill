-- Migration: Add email_provider_enum and provider column to user_email_accounts
-- This fixes the schema mismatch where the provider column was defined in Drizzle schema
-- but never migrated to the actual database

-- Create the email_provider_enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "public"."email_provider_enum" AS ENUM('sendgrid', 'nylas', 'unipile');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Add provider column to user_email_accounts table
ALTER TABLE "user_email_accounts" ADD COLUMN IF NOT EXISTS "provider" "email_provider_enum" DEFAULT 'sendgrid' NOT NULL;--> statement-breakpoint

-- Create index for provider column
CREATE INDEX IF NOT EXISTS "user_email_accounts_provider_idx" ON "user_email_accounts" USING btree ("provider");
