ALTER TYPE "public"."subscription_status_enum" ADD VALUE 'expired';--> statement-breakpoint
ALTER TYPE "public"."step_execution_status_enum" ADD VALUE 'processing' BEFORE 'scheduled';
