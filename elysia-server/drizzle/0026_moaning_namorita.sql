ALTER TABLE "email_replies" DROP CONSTRAINT "email_replies_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;