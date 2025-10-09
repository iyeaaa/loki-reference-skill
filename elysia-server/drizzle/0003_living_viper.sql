ALTER TABLE "sequence_steps" ADD COLUMN "scheduled_hour" integer DEFAULT 9;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD COLUMN "scheduled_minute" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD COLUMN "timezone" varchar(50) DEFAULT 'Asia/Seoul';