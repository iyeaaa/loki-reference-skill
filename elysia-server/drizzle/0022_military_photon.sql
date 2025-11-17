ALTER TYPE "public"."sequence_status_enum" ADD VALUE 'generating' BEFORE 'ready';--> statement-breakpoint
ALTER TABLE "sequence_step_executions" ADD COLUMN "generation_source" "generation_mode_enum" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD COLUMN "generation_source" "generation_mode_enum" DEFAULT 'manual' NOT NULL;