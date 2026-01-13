CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"target_currency" varchar(3) NOT NULL,
	"rate" varchar(30) NOT NULL,
	"source" varchar(50),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount" bigint NOT NULL,
	"is_primary" boolean DEFAULT false,
	"display_amount" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_rates_currencies_idx" ON "exchange_rates" USING btree ("base_currency","target_currency");--> statement-breakpoint
CREATE INDEX "exchange_rates_unique_idx" ON "exchange_rates" USING btree ("base_currency","target_currency");--> statement-breakpoint
CREATE INDEX "plan_prices_plan_id_idx" ON "plan_prices" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_prices_currency_idx" ON "plan_prices" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "plan_prices_unique_idx" ON "plan_prices" USING btree ("plan_id","currency");