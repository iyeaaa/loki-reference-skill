CREATE TYPE "public"."sales_strategy_country_enum" AS ENUM('jp', 'us', 'sea', 'eu', 'cn', 'ae');--> statement-breakpoint
CREATE TYPE "public"."sales_strategy_experience_enum" AS ENUM('none', 'some', 'experienced');--> statement-breakpoint
CREATE TYPE "public"."sales_strategy_industry_enum" AS ENUM('manufacturing', 'it_saas', 'beauty', 'food', 'fashion', 'electronics', 'healthcare', 'guitar');--> statement-breakpoint
CREATE TYPE "public"."sales_strategy_target_enum" AS ENUM('b2b', 'b2c', 'both');--> statement-breakpoint
CREATE TABLE "sales_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry" "sales_strategy_industry_enum" NOT NULL,
	"target" "sales_strategy_target_enum" NOT NULL,
	"country" "sales_strategy_country_enum" NOT NULL,
	"experience" "sales_strategy_experience_enum" NOT NULL,
	"linda_solution" jsonb,
	"strategies" jsonb,
	"proof_points" jsonb,
	"email_benchmarks" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_sales_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sales_strategy_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_sales_strategies" ADD CONSTRAINT "workspace_sales_strategies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_sales_strategies" ADD CONSTRAINT "workspace_sales_strategies_sales_strategy_id_sales_strategies_id_fk" FOREIGN KEY ("sales_strategy_id") REFERENCES "public"."sales_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_strategies_industry_idx" ON "sales_strategies" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "sales_strategies_country_idx" ON "sales_strategies" USING btree ("country");--> statement-breakpoint
CREATE INDEX "workspace_sales_strategies_workspace_id_idx" ON "workspace_sales_strategies" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_sales_strategies_sales_strategy_id_idx" ON "workspace_sales_strategies" USING btree ("sales_strategy_id");