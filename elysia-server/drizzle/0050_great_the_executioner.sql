ALTER TABLE "visitor_sessions" ADD COLUMN "visitor_type" varchar(20) DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "is_b2b_lead" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "lead_score" smallint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "zip" varchar(20);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "is_eu_member" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "calling_code" varchar(10);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "currency_code" varchar(10);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "company_network" varchar(50);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "company_abuser_score" varchar(20);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "asn_route" varchar(50);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "asn_descr" varchar(255);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "asn_domain" varchar(255);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "asn_country" varchar(10);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "asn_abuse_email" varchar(255);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "asn_abuser_score" varchar(20);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "datacenter_name" varchar(255);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "datacenter_domain" varchar(255);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "datacenter_network" varchar(50);--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "is_bogon" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD COLUMN "is_satellite" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "visitor_sessions_visitor_type_idx" ON "visitor_sessions" USING btree ("visitor_type");--> statement-breakpoint
CREATE INDEX "visitor_sessions_is_b2b_lead_idx" ON "visitor_sessions" USING btree ("is_b2b_lead");--> statement-breakpoint
CREATE INDEX "visitor_sessions_lead_score_idx" ON "visitor_sessions" USING btree ("lead_score");