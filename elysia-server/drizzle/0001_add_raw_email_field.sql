-- Add raw_email field to emails table for storing RFC 822 format emails
ALTER TABLE "emails" ADD COLUMN "raw_email" text;

-- Add comment to the column
COMMENT ON COLUMN "emails"."raw_email" IS 'RFC 822 format raw email (for inbound emails)';
