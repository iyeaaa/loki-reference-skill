CREATE TABLE "user_signature_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"signature_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_signatures" DROP CONSTRAINT "email_signatures_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "email_signatures" DROP CONSTRAINT "email_signatures_workspace_id_workspaces_id_fk";
--> statement-breakpoint
DROP INDEX "email_signatures_is_default_idx";--> statement-breakpoint
ALTER TABLE "email_signatures" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_signatures" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_signature_preferences" ADD CONSTRAINT "user_signature_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_signature_preferences" ADD CONSTRAINT "user_signature_preferences_signature_id_email_signatures_id_fk" FOREIGN KEY ("signature_id") REFERENCES "public"."email_signatures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_signature_preferences_user_id" ON "user_signature_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_signature_preferences_signature_id" ON "user_signature_preferences" USING btree ("signature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_signature" ON "user_signature_preferences" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_signatures" DROP COLUMN "is_default";