CREATE TABLE "email_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"signature_html" text NOT NULL,
	"signature_text" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_signatures_user_id_idx" ON "email_signatures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_signatures_workspace_id_idx" ON "email_signatures" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "email_signatures_is_default_idx" ON "email_signatures" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "email_signatures_is_active_idx" ON "email_signatures" USING btree ("is_active");