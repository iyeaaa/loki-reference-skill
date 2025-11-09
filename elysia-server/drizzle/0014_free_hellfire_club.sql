ALTER TABLE "workspaces" ADD COLUMN "company_name" varchar(255);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "company_website" varchar(500);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "company_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "industry" varchar(100);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "company_size" varchar(50);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "company_address" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "company_description" text;