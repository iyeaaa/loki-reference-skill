CREATE TABLE "visitor_excluded_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_domain" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"excluded_by" uuid NOT NULL,
	"excluded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_excluded_companies_workspace_domain_unique" UNIQUE("workspace_id","company_domain")
);
--> statement-breakpoint
ALTER TABLE "visitor_excluded_companies" ADD CONSTRAINT "visitor_excluded_companies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_excluded_companies" ADD CONSTRAINT "visitor_excluded_companies_excluded_by_users_id_fk" FOREIGN KEY ("excluded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_excluded_companies_workspace_idx" ON "visitor_excluded_companies" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "visitor_excluded_companies_domain_idx" ON "visitor_excluded_companies" USING btree ("company_domain");--> statement-breakpoint
CREATE INDEX "visitor_excluded_companies_excluded_by_idx" ON "visitor_excluded_companies" USING btree ("excluded_by");