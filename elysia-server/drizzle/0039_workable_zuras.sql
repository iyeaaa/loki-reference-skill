ALTER TABLE "email_replies" ALTER COLUMN "reply_email_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_replies" DROP COLUMN "from_email";--> statement-breakpoint
ALTER TABLE "email_replies" DROP COLUMN "subject";--> statement-breakpoint
ALTER TABLE "email_replies" DROP COLUMN "body";--> statement-breakpoint
ALTER TABLE "email_replies" DROP COLUMN "received_at";--> statement-breakpoint
ALTER TABLE "email_replies" DROP COLUMN "is_archived";