CREATE TYPE "public"."job_status_enum" AS ENUM('waiting', 'active', 'completed', 'failed', 'delayed', 'stalled');--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"queue_name" varchar(100) NOT NULL,
	"job_name" varchar(255),
	"status" "job_status_enum" DEFAULT 'waiting' NOT NULL,
	"attempts_made" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"priority" integer DEFAULT 0,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"duration_ms" integer,
	"delayed_until" timestamp with time zone,
	"input_data" jsonb,
	"output_data" jsonb,
	"error_message" text,
	"stack_trace" text,
	"error_code" varchar(100),
	"worker_name" varchar(100),
	"processed_by" varchar(255),
	"job_options" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "job_logs_queue_status_idx" ON "job_logs" USING btree ("queue_name","status");--> statement-breakpoint
CREATE INDEX "job_logs_job_id_idx" ON "job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_logs_queue_name_idx" ON "job_logs" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX "job_logs_status_idx" ON "job_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_logs_added_at_idx" ON "job_logs" USING btree ("added_at");--> statement-breakpoint
CREATE INDEX "job_logs_completed_at_idx" ON "job_logs" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "job_logs_failed_at_idx" ON "job_logs" USING btree ("failed_at");--> statement-breakpoint
CREATE INDEX "job_logs_error_code_idx" ON "job_logs" USING btree ("error_code");