CREATE TABLE "trial_stat_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"excluded_by" uuid NOT NULL,
	"excluded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	CONSTRAINT "trial_stat_exclusions_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "trial_stat_exclusions" ADD CONSTRAINT "trial_stat_exclusions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_stat_exclusions" ADD CONSTRAINT "trial_stat_exclusions_excluded_by_users_id_fk" FOREIGN KEY ("excluded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trial_stat_exclusions_workspace_idx" ON "trial_stat_exclusions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "trial_stat_exclusions_excluded_by_idx" ON "trial_stat_exclusions" USING btree ("excluded_by");--> statement-breakpoint
CREATE INDEX "trial_stat_exclusions_excluded_at_idx" ON "trial_stat_exclusions" USING btree ("excluded_at");