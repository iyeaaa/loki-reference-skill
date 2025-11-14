ALTER TABLE "emails" ADD COLUMN "is_important" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;