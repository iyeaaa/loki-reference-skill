CREATE TYPE "public"."email_account_status_enum" AS ENUM('active', 'inactive', 'error', 'rate_limited', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."email_bounce_type_enum" AS ENUM('soft', 'hard', 'block');--> statement-breakpoint
CREATE TYPE "public"."email_direction_enum" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."email_event_type_enum" AS ENUM('processed', 'delivered', 'open', 'click', 'bounce', 'dropped', 'deferred', 'spam_report', 'unsubscribe');--> statement-breakpoint
CREATE TYPE "public"."email_reply_sentiment_enum" AS ENUM('positive', 'neutral', 'negative', 'interested', 'not_interested');--> statement-breakpoint
CREATE TYPE "public"."email_status_enum" AS ENUM('draft', 'scheduled', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'spam', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."contact_type_enum" AS ENUM('phone', 'email', 'fax', 'other');--> statement-breakpoint
CREATE TYPE "public"."social_media_platform_enum" AS ENUM('facebook', 'instagram', 'twitter', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."lead_status_enum" AS ENUM('new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status_enum" AS ENUM('active', 'paused', 'completed', 'stopped', 'bounced', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."sequence_status_enum" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."step_execution_status_enum" AS ENUM('pending', 'scheduled', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."user_role_enum" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."generation_mode_enum" AS ENUM('ai', 'manual', 'template');--> statement-breakpoint
CREATE TYPE "public"."workflow_email_status_enum" AS ENUM('pending', 'generating', 'generated', 'edited', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_role_enum" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_status_enum" AS ENUM('invited', 'active', 'inactive', 'removed');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"details" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"criteria" jsonb,
	"is_dynamic" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email_address" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"api_key" text NOT NULL,
	"sendgrid_verified_sender_id" varchar(255),
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"daily_limit" integer,
	"monthly_limit" integer,
	"daily_sent_count" integer DEFAULT 0 NOT NULL,
	"monthly_sent_count" integer DEFAULT 0 NOT NULL,
	"last_reset_daily" date,
	"last_reset_monthly" date,
	"status" "email_account_status_enum" DEFAULT 'inactive' NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"subject" varchar(500) NOT NULL,
	"body_text" text,
	"body_html" text,
	"variables" jsonb,
	"category" varchar(100),
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"event_type" "email_event_type_enum" NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"sendgrid_event_id" varchar(500),
	"user_agent" text,
	"ip_address" varchar(50),
	"url" text,
	"bounce_type" varchar(50),
	"bounce_reason" text,
	"smtp_response" text,
	"raw_event_data" jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"original_email_id" uuid NOT NULL,
	"reply_email_id" uuid NOT NULL,
	"sentiment" "email_reply_sentiment_enum",
	"intent" varchar(255),
	"ai_summary" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_email_account_id" uuid NOT NULL,
	"lead_id" uuid,
	"sequence_id" uuid,
	"step_id" uuid,
	"direction" "email_direction_enum" NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"to_email" varchar(255) NOT NULL,
	"cc_emails" text[],
	"bcc_emails" text[],
	"subject" varchar(500),
	"body_text" text,
	"body_html" text,
	"raw_email" text,
	"status" "email_status_enum" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"bounce_type" "email_bounce_type_enum",
	"bounce_reason" text,
	"error_message" text,
	"sendgrid_message_id" varchar(500),
	"message_id" varchar(500),
	"in_reply_to" varchar(500),
	"thread_id" varchar(500),
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"lead_name" varchar(255),
	"lead_email" varchar(255),
	"sequence_name" varchar(255),
	"unsubscribed_at" timestamp with time zone,
	"spam_reported_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_business_sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"sector_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"contact_type" "contact_type_enum" NOT NULL,
	"contact_value" varchar(255) NOT NULL,
	"label" varchar(100),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_industry_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"industry_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"category_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_social_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"platform" "social_media_platform_enum" NOT NULL,
	"url" varchar(500) NOT NULL,
	"username" varchar(255),
	"follower_count" varchar(50),
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_name" varchar(255),
	"found_company_name" varchar(255),
	"website_url" varchar(500),
	"final_url" varchar(500),
	"http_status" integer,
	"name_url_match" boolean,
	"business_type" varchar(100),
	"is_business_type_matched" boolean,
	"description" text,
	"address" text,
	"country" varchar(100),
	"city" varchar(100),
	"state" varchar(100),
	"founded_year" integer,
	"employee_count" varchar(50),
	"lead_source" varchar(100),
	"lead_status" "lead_status_enum" DEFAULT 'new' NOT NULL,
	"lead_score" integer,
	"notes" text,
	"crawl_time_seconds" numeric(10, 2),
	"gpt_time_seconds" numeric(10, 2),
	"collected_at" timestamp with time zone,
	"error_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_contacted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_email_account_id" uuid NOT NULL,
	"current_step_order" integer DEFAULT 0 NOT NULL,
	"status" "enrollment_status_enum" DEFAULT 'active' NOT NULL,
	"enrolled_by" uuid,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_email_sent_at" timestamp with time zone,
	"last_email_sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"next_step_scheduled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sequence_step_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"status" "step_execution_status_enum" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"error_message" text,
	"email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"email_subject" varchar(500) NOT NULL,
	"email_body_text" text,
	"email_body_html" text,
	"email_template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_group_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"workflow_data" text,
	"status" "sequence_status_enum" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(100) NOT NULL,
	"password_hash" varchar(255),
	"user_role" "user_role_enum" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"department_id" uuid NOT NULL,
	"employee_id" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_generated_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"node_id" varchar(255) NOT NULL,
	"lead_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body_text" text,
	"body_html" text,
	"status" "workflow_email_status_enum" DEFAULT 'pending' NOT NULL,
	"generation_mode" "generation_mode_enum" DEFAULT 'manual' NOT NULL,
	"ai_prompt" text,
	"ai_model" varchar(100),
	"generation_error" text,
	"context_snapshot" jsonb,
	"generated_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_email_account_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"current_node_id" varchar(100),
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"enrolled_by" uuid,
	"first_email_sent_at" timestamp,
	"last_email_sent_at" timestamp,
	"completed_at" timestamp,
	"paused_at" timestamp,
	"stopped_at" timestamp,
	"stopped_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_execution_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"node_id" varchar(100) NOT NULL,
	"node_type" varchar(50) NOT NULL,
	"node_data" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"result" text,
	"error_message" text,
	"generated_email_id" uuid,
	"email_id" uuid,
	"sent_at" timestamp,
	"scheduled_for" timestamp,
	"delay_days" integer,
	"wait_started_at" timestamp,
	"wait_completed_at" timestamp,
	"replied_during_wait" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_member_role_enum" DEFAULT 'member' NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	"status" "workspace_member_status_enum" DEFAULT 'invited' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_group_id_customer_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."customer_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_accounts" ADD CONSTRAINT "user_email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_accounts" ADD CONSTRAINT "user_email_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_original_email_id_emails_id_fk" FOREIGN KEY ("original_email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_reply_email_id_emails_id_fk" FOREIGN KEY ("reply_email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_email_account_id_user_email_accounts_id_fk" FOREIGN KEY ("user_email_account_id") REFERENCES "public"."user_email_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_step_id_sequence_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."sequence_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_business_sectors" ADD CONSTRAINT "lead_business_sectors_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_industry_types" ADD CONSTRAINT "lead_industry_types_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_product_categories" ADD CONSTRAINT "lead_product_categories_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_products" ADD CONSTRAINT "lead_products_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_social_media" ADD CONSTRAINT "lead_social_media_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_user_email_account_id_user_email_accounts_id_fk" FOREIGN KEY ("user_email_account_id") REFERENCES "public"."user_email_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_step_executions" ADD CONSTRAINT "sequence_step_executions_enrollment_id_sequence_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."sequence_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_step_executions" ADD CONSTRAINT "sequence_step_executions_step_id_sequence_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."sequence_steps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_customer_group_id_customer_groups_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "public"."customer_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_generated_emails" ADD CONSTRAINT "workflow_generated_emails_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_generated_emails" ADD CONSTRAINT "workflow_generated_emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_user_email_account_id_user_email_accounts_id_fk" FOREIGN KEY ("user_email_account_id") REFERENCES "public"."user_email_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_enrollment_id_workflow_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."workflow_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_workspace_id_idx" ON "activity_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_entity_type_idx" ON "activity_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "activity_logs_entity_idx" ON "activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customer_group_members_group_id_idx" ON "customer_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "customer_group_members_lead_id_idx" ON "customer_group_members" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "customer_groups_workspace_id_idx" ON "customer_groups" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "customer_groups_created_by_idx" ON "customer_groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "customer_groups_name_idx" ON "customer_groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_email_accounts_user_id_idx" ON "user_email_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_email_accounts_workspace_id_idx" ON "user_email_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "user_email_accounts_email_address_idx" ON "user_email_accounts" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "user_email_accounts_status_idx" ON "user_email_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_email_accounts_is_default_idx" ON "user_email_accounts" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "email_templates_workspace_id_idx" ON "email_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "email_templates_created_by_idx" ON "email_templates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "email_templates_category_idx" ON "email_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "email_templates_name_idx" ON "email_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "email_events_email_id_idx" ON "email_events" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "email_events_event_type_idx" ON "email_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "email_events_timestamp_idx" ON "email_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "email_events_processed_idx" ON "email_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "email_replies_workspace_id_idx" ON "email_replies" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "email_replies_original_email_id_idx" ON "email_replies" USING btree ("original_email_id");--> statement-breakpoint
CREATE INDEX "email_replies_reply_email_id_idx" ON "email_replies" USING btree ("reply_email_id");--> statement-breakpoint
CREATE INDEX "email_replies_sentiment_idx" ON "email_replies" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "email_replies_is_read_idx" ON "email_replies" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "emails_workspace_user_idx" ON "emails" USING btree ("workspace_id","user_email_account_id");--> statement-breakpoint
CREATE INDEX "emails_lead_id_idx" ON "emails" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "emails_sequence_id_idx" ON "emails" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "emails_status_direction_idx" ON "emails" USING btree ("status","direction");--> statement-breakpoint
CREATE INDEX "emails_thread_id_idx" ON "emails" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "emails_scheduled_at_idx" ON "emails" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "emails_message_id_idx" ON "emails" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "emails_in_reply_to_idx" ON "emails" USING btree ("in_reply_to");--> statement-breakpoint
CREATE INDEX "lead_business_sectors_lead_id_idx" ON "lead_business_sectors" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_business_sectors_sector_name_idx" ON "lead_business_sectors" USING btree ("sector_name");--> statement-breakpoint
CREATE INDEX "lead_contacts_lead_id_idx" ON "lead_contacts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_contacts_contact_type_idx" ON "lead_contacts" USING btree ("contact_type");--> statement-breakpoint
CREATE INDEX "lead_contacts_is_primary_idx" ON "lead_contacts" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "lead_industry_types_lead_id_idx" ON "lead_industry_types" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_industry_types_industry_name_idx" ON "lead_industry_types" USING btree ("industry_name");--> statement-breakpoint
CREATE INDEX "lead_product_categories_lead_id_idx" ON "lead_product_categories" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_product_categories_category_name_idx" ON "lead_product_categories" USING btree ("category_name");--> statement-breakpoint
CREATE INDEX "lead_products_lead_id_idx" ON "lead_products" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_products_product_name_idx" ON "lead_products" USING btree ("product_name");--> statement-breakpoint
CREATE INDEX "lead_social_media_lead_id_idx" ON "lead_social_media" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_social_media_platform_idx" ON "lead_social_media" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "leads_workspace_id_idx" ON "leads" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "leads_lead_status_idx" ON "leads" USING btree ("lead_status");--> statement-breakpoint
CREATE INDEX "leads_created_by_idx" ON "leads" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "leads_company_name_idx" ON "leads" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "sequence_enrollments_sequence_id_idx" ON "sequence_enrollments" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "sequence_enrollments_lead_id_idx" ON "sequence_enrollments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "sequence_enrollments_status_idx" ON "sequence_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sequence_enrollments_next_step_idx" ON "sequence_enrollments" USING btree ("next_step_scheduled_at");--> statement-breakpoint
CREATE INDEX "sequence_enrollments_email_account_idx" ON "sequence_enrollments" USING btree ("user_email_account_id");--> statement-breakpoint
CREATE INDEX "sequence_step_executions_enrollment_id_idx" ON "sequence_step_executions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "sequence_step_executions_step_id_idx" ON "sequence_step_executions" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "sequence_step_executions_status_idx" ON "sequence_step_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sequence_step_executions_scheduled_idx" ON "sequence_step_executions" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "sequence_steps_sequence_id_idx" ON "sequence_steps" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "sequence_steps_order_idx" ON "sequence_steps" USING btree ("sequence_id","step_order");--> statement-breakpoint
CREATE INDEX "sequences_workspace_id_idx" ON "sequences" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sequences_customer_group_id_idx" ON "sequences" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "sequences_status_idx" ON "sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sequences_created_by_idx" ON "sequences" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "departments_code_idx" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "departments_is_active_idx" ON "departments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "users_department_id_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "workflow_emails_sequence_node_idx" ON "workflow_generated_emails" USING btree ("sequence_id","node_id");--> statement-breakpoint
CREATE INDEX "workflow_emails_status_idx" ON "workflow_generated_emails" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_emails_lead_idx" ON "workflow_generated_emails" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_status_idx" ON "workspace_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workspaces_owner_id_idx" ON "workspaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "workspaces_is_active_idx" ON "workspaces" USING btree ("is_active");