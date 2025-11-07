CREATE TABLE "openai_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"api_key" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "openai_api_keys" ADD CONSTRAINT "openai_api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "openai_api_keys_workspace_id_idx" ON "openai_api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "openai_api_keys_is_active_idx" ON "openai_api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "openai_api_keys_order_index_idx" ON "openai_api_keys" USING btree ("order_index");