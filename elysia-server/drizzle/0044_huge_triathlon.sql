CREATE TYPE "public"."followup_email_type" AS ENUM('welcome', 'signup_only', 'before_connect', 'no_campaign', 'inactive_7days');--> statement-breakpoint
CREATE TABLE "followup_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"email_type" "followup_email_type" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loops_message_id" varchar(255),
	"opened" boolean DEFAULT false,
	"opened_at" timestamp with time zone,
	"clicked" boolean DEFAULT false,
	"clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_email_type" UNIQUE("user_id","email_type")
);
--> statement-breakpoint
ALTER TABLE "followup_emails" ADD CONSTRAINT "followup_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_emails" ADD CONSTRAINT "followup_emails_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_followup_emails_user_id" ON "followup_emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_followup_emails_email_type" ON "followup_emails" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX "idx_followup_emails_sent_at" ON "followup_emails" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_followup_emails_type_opened" ON "followup_emails" USING btree ("email_type","opened");