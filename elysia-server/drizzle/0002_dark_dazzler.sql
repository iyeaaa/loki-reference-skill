CREATE TABLE "address_book_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"company" varchar(160) NOT NULL,
	"email" varchar(200) NOT NULL,
	"industry_type" varchar(100),
	"product_category" varchar(100),
	"description" varchar(1000),
	"website_url" varchar(500),
	"country" varchar(100),
	"linkedin_url" varchar(500),
	"facebook_url" varchar(500),
	"instagram_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_book_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "address_book_contacts" ADD CONSTRAINT "address_book_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_book_contacts" ADD CONSTRAINT "address_book_contacts_group_id_address_book_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."address_book_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_book_groups" ADD CONSTRAINT "address_book_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_book_contacts_user_group_idx" ON "address_book_contacts" USING btree ("user_id","group_id");--> statement-breakpoint
CREATE INDEX "address_book_contacts_group_id_idx" ON "address_book_contacts" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "address_book_contacts_email_idx" ON "address_book_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "address_book_groups_user_name_idx" ON "address_book_groups" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "address_book_groups_name_idx" ON "address_book_groups" USING btree ("name");