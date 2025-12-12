CREATE TYPE "public"."onboarding_status_enum" AS ENUM('not_started', 'survey_completed', 'company_info', 'lead_search', 'email_generation', 'email_link', 'completed');--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" "onboarding_status_enum" DEFAULT 'not_started' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"survey_data" jsonb,
	"company_info_completed_at" timestamp with time zone,
	"selected_lead_ids" jsonb,
	"customer_group_id" uuid,
	"lead_search_completed_at" timestamp with time zone,
	"generated_sequence_id" uuid,
	"email_generation_completed_at" timestamp with time zone,
	"email_link_completed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_progress_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_role" SET DEFAULT 'user'::text;--> statement-breakpoint
DROP TYPE "public"."user_role_enum";--> statement-breakpoint
CREATE TYPE "public"."user_role_enum" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_role" SET DEFAULT 'user'::"public"."user_role_enum";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_role" SET DATA TYPE "public"."user_role_enum" USING "user_role"::"public"."user_role_enum";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_survey" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_step" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_progress_workspace_id_idx" ON "onboarding_progress" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "onboarding_progress_status_idx" ON "onboarding_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX "onboarding_progress_current_step_idx" ON "onboarding_progress" USING btree ("current_step");--> statement-breakpoint
CREATE INDEX "users_onboarding_step_idx" ON "users" USING btree ("onboarding_step");