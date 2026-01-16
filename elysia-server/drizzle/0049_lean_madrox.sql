CREATE TABLE "visitor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ip_address" varchar(50) NOT NULL,
	"user_agent" text,
	"referrer" varchar(500),
	"landing_page" varchar(500),
	"ipapi_data" jsonb,
	"country" varchar(100),
	"country_code" varchar(10),
	"city" varchar(100),
	"region" varchar(100),
	"latitude" real,
	"longitude" real,
	"timezone" varchar(50),
	"continent" varchar(50),
	"company_name" varchar(255),
	"company_domain" varchar(255),
	"company_type" varchar(100),
	"asn_number" integer,
	"asn_org" varchar(255),
	"asn_type" varchar(50),
	"is_vpn" boolean DEFAULT false,
	"is_proxy" boolean DEFAULT false,
	"is_tor" boolean DEFAULT false,
	"is_datacenter" boolean DEFAULT false,
	"is_crawler" boolean DEFAULT false,
	"is_mobile" boolean DEFAULT false,
	"is_abuser" boolean DEFAULT false,
	"visit_count" integer DEFAULT 1,
	"first_visit_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_visit_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD CONSTRAINT "visitor_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_sessions_workspace_id_idx" ON "visitor_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "visitor_sessions_ip_address_idx" ON "visitor_sessions" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "visitor_sessions_workspace_ip_idx" ON "visitor_sessions" USING btree ("workspace_id","ip_address");--> statement-breakpoint
CREATE INDEX "visitor_sessions_country_idx" ON "visitor_sessions" USING btree ("country");--> statement-breakpoint
CREATE INDEX "visitor_sessions_company_name_idx" ON "visitor_sessions" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "visitor_sessions_first_visit_idx" ON "visitor_sessions" USING btree ("first_visit_at");--> statement-breakpoint
CREATE INDEX "visitor_sessions_last_visit_idx" ON "visitor_sessions" USING btree ("last_visit_at");