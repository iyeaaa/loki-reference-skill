-- Update any 'invited' status to 'active' before enum migration
UPDATE "workspace_members" SET "status" = 'active' WHERE "status" = 'invited';--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."workspace_member_status_enum";--> statement-breakpoint
CREATE TYPE "public"."workspace_member_status_enum" AS ENUM('active', 'inactive', 'removed');--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."workspace_member_status_enum";--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "status" SET DATA TYPE "public"."workspace_member_status_enum" USING "status"::"public"."workspace_member_status_enum";--> statement-breakpoint
ALTER TABLE "lead_contacts" ADD COLUMN IF NOT EXISTS "contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "sequences" ADD COLUMN IF NOT EXISTS "selected_lead_ids" text;