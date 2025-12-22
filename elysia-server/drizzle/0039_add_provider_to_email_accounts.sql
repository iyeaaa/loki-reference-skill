-- Add email provider enum
DO $$ BEGIN
 CREATE TYPE "public"."email_provider_enum" AS ENUM('sendgrid', 'nylas', 'unipile');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add provider column to user_email_accounts
ALTER TABLE "user_email_accounts" ADD COLUMN "provider" "email_provider_enum" DEFAULT 'sendgrid' NOT NULL;
--> statement-breakpoint

-- Update existing records based on api_key pattern
UPDATE "user_email_accounts" 
SET "provider" = CASE 
  WHEN "api_key" LIKE 'SG%' THEN 'sendgrid'::email_provider_enum
  ELSE 'nylas'::email_provider_enum
END;
--> statement-breakpoint

-- Create index on provider column
CREATE INDEX IF NOT EXISTS "user_email_accounts_provider_idx" ON "user_email_accounts" USING btree ("provider");
--> statement-breakpoint

-- Add comment to provider column
COMMENT ON COLUMN "user_email_accounts"."provider" IS 'Email provider: sendgrid (API key starts with SG), nylas (grantId), unipile (account_id)';
