CREATE TABLE "billing_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"customer_key" varchar(255) NOT NULL,
	"billing_key" varchar(255) NOT NULL,
	"card_company" varchar(50),
	"card_number" varchar(50),
	"card_type" varchar(20),
	"owner_type" varchar(20),
	"authenticated_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_keys_customer_key_unique" UNIQUE("customer_key"),
	CONSTRAINT "billing_keys_billing_key_unique" UNIQUE("billing_key")
);
--> statement-breakpoint
ALTER TABLE "billing_keys" ADD CONSTRAINT "billing_keys_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_keys_customer_key_idx" ON "billing_keys" USING btree ("customer_key");--> statement-breakpoint
CREATE INDEX "billing_keys_billing_key_idx" ON "billing_keys" USING btree ("billing_key");--> statement-breakpoint
CREATE INDEX "billing_keys_customer_id_idx" ON "billing_keys" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "billing_keys_active_idx" ON "billing_keys" USING btree ("is_active");