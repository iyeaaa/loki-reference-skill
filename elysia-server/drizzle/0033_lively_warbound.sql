CREATE TYPE "public"."plan_interval_enum" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."plan_type_enum" AS ENUM('one_time', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."policy_effect_enum" AS ENUM('allow', 'deny');--> statement-breakpoint
CREATE TYPE "public"."subscription_status_enum" AS ENUM('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier_enum" AS ENUM('trial', 'basic', 'pro', 'enterprise');--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"external_customer_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"name" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "billing_customers_external_customer_id_unique" UNIQUE("external_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"external_plan_id" varchar(255),
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false,
	"currency" varchar(3) DEFAULT 'KRW' NOT NULL,
	"amount" bigint NOT NULL,
	"plan_type" "plan_type_enum" DEFAULT 'recurring' NOT NULL,
	"billing_interval" "plan_interval_enum" DEFAULT 'month',
	"interval_count" integer DEFAULT 1,
	"trial_days" integer DEFAULT 0,
	"features_override" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_plans_external_plan_id_unique" UNIQUE("external_plan_id")
);
--> statement-breakpoint
CREATE TABLE "billing_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_product_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"description" text,
	"tier" "subscription_tier_enum" NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_products_external_product_id_unique" UNIQUE("external_product_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"previous_plan_id" uuid,
	"new_plan_id" uuid,
	"previous_status" "subscription_status_enum",
	"new_status" "subscription_status_enum",
	"change_type" varchar(50) NOT NULL,
	"change_reason" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"external_subscription_id" varchar(255),
	"status" "subscription_status_enum" DEFAULT 'trialing' NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"cancel_reason" text,
	"ended_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_external_subscription_id_unique" UNIQUE("external_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "iam_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid NOT NULL,
	"target_name" varchar(255),
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam_member_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"attached_by" uuid,
	"attached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_member_policies_member_policy_unique" UNIQUE("member_id","policy_id")
);
--> statement-breakpoint
CREATE TABLE "iam_member_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_member_roles_member_role_unique" UNIQUE("member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "iam_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_managed" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam_policy_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"sid" varchar(100),
	"effect" "policy_effect_enum" DEFAULT 'allow' NOT NULL,
	"resources" text[] NOT NULL,
	"actions" text[] NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam_role_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"attached_by" uuid,
	"attached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_role_policies_role_policy_unique" UNIQUE("role_id","policy_id")
);
--> statement-breakpoint
CREATE TABLE "iam_tier_boundaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "subscription_tier_enum" NOT NULL,
	"policy_id" uuid NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_tier_boundaries_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "iam_workspace_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_workspace_roles_workspace_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "subscription_tier" "subscription_tier_enum" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "subscription_status" "subscription_status_enum" DEFAULT 'trialing' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "subscription_valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "tier_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plans" ADD CONSTRAINT "billing_plans_product_id_billing_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."billing_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_previous_plan_id_billing_plans_id_fk" FOREIGN KEY ("previous_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_new_plan_id_billing_plans_id_fk" FOREIGN KEY ("new_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_audit_logs" ADD CONSTRAINT "iam_audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_audit_logs" ADD CONSTRAINT "iam_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_policies" ADD CONSTRAINT "iam_member_policies_member_id_workspace_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."workspace_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_policies" ADD CONSTRAINT "iam_member_policies_policy_id_iam_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."iam_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_policies" ADD CONSTRAINT "iam_member_policies_attached_by_users_id_fk" FOREIGN KEY ("attached_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_roles" ADD CONSTRAINT "iam_member_roles_member_id_workspace_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."workspace_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_roles" ADD CONSTRAINT "iam_member_roles_role_id_iam_workspace_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."iam_workspace_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_roles" ADD CONSTRAINT "iam_member_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_policies" ADD CONSTRAINT "iam_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_policies" ADD CONSTRAINT "iam_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_policy_statements" ADD CONSTRAINT "iam_policy_statements_policy_id_iam_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."iam_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_role_policies" ADD CONSTRAINT "iam_role_policies_role_id_iam_workspace_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."iam_workspace_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_role_policies" ADD CONSTRAINT "iam_role_policies_policy_id_iam_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."iam_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_role_policies" ADD CONSTRAINT "iam_role_policies_attached_by_users_id_fk" FOREIGN KEY ("attached_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_tier_boundaries" ADD CONSTRAINT "iam_tier_boundaries_policy_id_iam_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."iam_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_workspace_roles" ADD CONSTRAINT "iam_workspace_roles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_workspace_roles" ADD CONSTRAINT "iam_workspace_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_customers_user_id_idx" ON "billing_customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_customers_external_id_idx" ON "billing_customers" USING btree ("external_customer_id");--> statement-breakpoint
CREATE INDEX "billing_plans_product_id_idx" ON "billing_plans" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "billing_plans_active_idx" ON "billing_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "billing_products_tier_idx" ON "billing_products" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "billing_products_active_idx" ON "billing_products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscription_history_subscription_id_idx" ON "subscription_history" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_history_change_type_idx" ON "subscription_history" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "subscription_history_created_at_idx" ON "subscription_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_workspace_id_idx" ON "subscriptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_id_idx" ON "subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_period_end_idx" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "iam_audit_logs_workspace_id_idx" ON "iam_audit_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "iam_audit_logs_user_id_idx" ON "iam_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "iam_audit_logs_action_idx" ON "iam_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "iam_audit_logs_target_idx" ON "iam_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "iam_audit_logs_created_at_idx" ON "iam_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "iam_member_policies_member_id_idx" ON "iam_member_policies" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "iam_member_policies_policy_id_idx" ON "iam_member_policies" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "iam_member_roles_member_id_idx" ON "iam_member_roles" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "iam_member_roles_role_id_idx" ON "iam_member_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "iam_policies_workspace_id_idx" ON "iam_policies" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "iam_policies_name_idx" ON "iam_policies" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "iam_policies_is_managed_idx" ON "iam_policies" USING btree ("is_managed");--> statement-breakpoint
CREATE INDEX "iam_policy_statements_policy_id_idx" ON "iam_policy_statements" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "iam_policy_statements_effect_idx" ON "iam_policy_statements" USING btree ("effect");--> statement-breakpoint
CREATE INDEX "iam_role_policies_role_id_idx" ON "iam_role_policies" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "iam_role_policies_policy_id_idx" ON "iam_role_policies" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "iam_tier_boundaries_tier_idx" ON "iam_tier_boundaries" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "iam_workspace_roles_workspace_id_idx" ON "iam_workspace_roles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "iam_workspace_roles_is_default_idx" ON "iam_workspace_roles" USING btree ("workspace_id","is_default");--> statement-breakpoint
CREATE INDEX "workspaces_subscription_tier_idx" ON "workspaces" USING btree ("subscription_tier");--> statement-breakpoint
CREATE INDEX "workspaces_subscription_valid_idx" ON "workspaces" USING btree ("subscription_valid_until");