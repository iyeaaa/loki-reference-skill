CREATE TABLE "workspace_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255),
	"description" text,
	"category" varchar(255),
	"features" jsonb,
	"price_range" varchar(255),
	"target_audience" varchar(500),
	"image_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "website_analysis" jsonb;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "target_audiences" jsonb;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "expansion_goals" jsonb;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "competitive_advantages" jsonb;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "raw_research_output" jsonb;--> statement-breakpoint
ALTER TABLE "workspace_products" ADD CONSTRAINT "workspace_products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_products_workspace_id_idx" ON "workspace_products" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_products_category_idx" ON "workspace_products" USING btree ("category");