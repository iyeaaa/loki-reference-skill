-- ====================================
-- Hana Lang Connect Database Schema
-- ====================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add new schema named "public"
CREATE SCHEMA IF NOT EXISTS "public";
COMMENT ON SCHEMA "public" IS 'standard public schema';

-- ====================================
-- ENUMS
-- ====================================

-- Create user_role enum
CREATE TYPE user_role_enum AS ENUM ('admin', 'user', 'internal_reviewer', 'external_reviewer');

-- Create review_status enum for translation review workflow
CREATE TYPE review_status_enum AS ENUM (
    'pending',           -- 검수 대기
    'external_review',   -- 1차 외부 협력업체 검수 중
    'internal_review',   -- 2차 하나은행 내부 검수 중
    'approved',          -- 검수 완료 (승인)
    'rejected',          -- 검수 반려
    'revision_required'  -- 수정 요청
);


-- ====================================
-- MAIN TABLES
-- ====================================

-- Departments table
CREATE TABLE "public"."departments" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(100) NOT NULL,
    "code" character varying(20) NOT NULL,
    "description" text,
    "is_active" boolean DEFAULT true,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "departments_name_key" UNIQUE ("name"),
    CONSTRAINT "departments_code_key" UNIQUE ("code")
);

-- Languages table
CREATE TABLE "public"."languages" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "code" character varying(10) NOT NULL,
    "name" character varying(50) NOT NULL,
    "native_name" character varying(50),
    "is_active" boolean DEFAULT true,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "languages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "languages_code_key" UNIQUE ("code")
);

-- Users table
CREATE TABLE "public"."users" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "username" character varying(50) NOT NULL,
    "email" character varying(100) NOT NULL,
    "password_hash" character varying(255) NULL,
    "user_role" user_role_enum NOT NULL DEFAULT 'user',
    "is_active" boolean NOT NULL DEFAULT true,
    "department_id" uuid NOT NULL,
    "employee_id" character varying(20) NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" timestamptz NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_username_key" UNIQUE ("username"),
    CONSTRAINT "users_email_key" UNIQUE ("email"),
    CONSTRAINT "users_employee_id_key" UNIQUE ("employee_id"),
    CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments" ("id")
);

-- Translation data table
CREATE TABLE "public"."translation_data" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "source_text" text NOT NULL,
    "target_language" character varying(10) NOT NULL,
    "translated_text" text NOT NULL,
    "translation_engine" character varying(20),
    "redis_key" text,
    "element_context" jsonb,
    "quality_confidence_score" integer,
    "created_by" uuid,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "translation_data_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "translation_data_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users" ("id")
);

-- Translation reviews table
CREATE TABLE "public"."translation_reviews" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "translation_id" uuid NOT NULL,
    "review_status" review_status_enum DEFAULT 'pending',
    "current_reviewer" uuid,
    "external_reviewer_id" uuid,
    "internal_reviewer_id" uuid,
    "external_reviewed_at" timestamptz,
    "internal_reviewed_at" timestamptz,
    "final_approved_at" timestamptz,
    "rejection_reason" text,
    "priority" integer DEFAULT 3,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "translation_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "translation_reviews_translation_id_fkey" FOREIGN KEY ("translation_id") REFERENCES "public"."translation_data" ("id") ON DELETE CASCADE,
    CONSTRAINT "translation_reviews_current_reviewer_fkey" FOREIGN KEY ("current_reviewer") REFERENCES "public"."users" ("id"),
    CONSTRAINT "translation_reviews_external_reviewer_fkey" FOREIGN KEY ("external_reviewer_id") REFERENCES "public"."users" ("id"),
    CONSTRAINT "translation_reviews_internal_reviewer_fkey" FOREIGN KEY ("internal_reviewer_id") REFERENCES "public"."users" ("id"),
    CONSTRAINT "translation_reviews_translation_unique" UNIQUE ("translation_id")
);


-- Translation review history table
CREATE TABLE "public"."translation_review_history" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "translation_id" uuid NOT NULL,
    "reviewer_id" uuid NOT NULL,
    "review_stage" character varying(20) NOT NULL,
    "status" review_status_enum NOT NULL,
    "comments" text,
    "reviewed_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "original_text" text,
    "revised_text" text,
    CONSTRAINT "translation_review_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "translation_review_history_translation_id_fkey" FOREIGN KEY ("translation_id") REFERENCES "public"."translation_data" ("id") ON DELETE CASCADE,
    CONSTRAINT "translation_review_history_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users" ("id")
);

-- User edit language permissions table
CREATE TABLE "public"."user_edit_languages" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "language_id" uuid NOT NULL,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_edit_languages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_edit_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE,
    CONSTRAINT "user_edit_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "public"."languages" ("id") ON DELETE CASCADE,
    CONSTRAINT "user_edit_languages_unique" UNIQUE ("user_id", "language_id")
);

-- User review language permissions table
CREATE TABLE "public"."user_review_languages" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "language_id" uuid NOT NULL,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_review_languages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_review_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE,
    CONSTRAINT "user_review_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "public"."languages" ("id") ON DELETE CASCADE,
    CONSTRAINT "user_review_languages_unique" UNIQUE ("user_id", "language_id")
);

-- Review notifications table
CREATE TABLE "public"."review_notifications" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "translation_id" uuid NOT NULL,
    "notification_type" character varying(50) NOT NULL,
    "message" text NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "review_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE,
    CONSTRAINT "review_notifications_translation_id_fkey" FOREIGN KEY ("translation_id") REFERENCES "public"."translation_data" ("id") ON DELETE CASCADE
);

-- ====================================
-- INDEXES
-- ====================================

-- Translation data indexes
CREATE UNIQUE INDEX "translation_data_source_target_idx" 
ON "public"."translation_data" (md5("source_text"), "target_language");

CREATE INDEX "translation_data_created_by_idx" ON "public"."translation_data" ("created_by");

-- Departments indexes
CREATE INDEX "departments_code_idx" ON "public"."departments" ("code");
CREATE INDEX "departments_is_active_idx" ON "public"."departments" ("is_active");

-- Users department index
CREATE INDEX "users_department_id_idx" ON "public"."users" ("department_id");

-- Languages indexes
CREATE INDEX "languages_code_idx" ON "public"."languages" ("code");
CREATE INDEX "languages_is_active_idx" ON "public"."languages" ("is_active");

-- User edit languages indexes
CREATE INDEX "user_edit_languages_user_id_idx" ON "public"."user_edit_languages" ("user_id");
CREATE INDEX "user_edit_languages_language_id_idx" ON "public"."user_edit_languages" ("language_id");

-- User review languages indexes
CREATE INDEX "user_review_languages_user_id_idx" ON "public"."user_review_languages" ("user_id");
CREATE INDEX "user_review_languages_language_id_idx" ON "public"."user_review_languages" ("language_id");

-- Translation reviews indexes
CREATE INDEX "translation_reviews_translation_id_idx" ON "public"."translation_reviews" ("translation_id");
CREATE INDEX "translation_reviews_review_status_idx" ON "public"."translation_reviews" ("review_status");
CREATE INDEX "translation_reviews_current_reviewer_idx" ON "public"."translation_reviews" ("current_reviewer");
CREATE INDEX "translation_reviews_priority_created_idx" ON "public"."translation_reviews" ("priority" DESC, "created_at" ASC);



-- Translation review history indexes
CREATE INDEX "translation_review_history_translation_id_idx" ON "public"."translation_review_history" ("translation_id");
CREATE INDEX "translation_review_history_reviewer_id_idx" ON "public"."translation_review_history" ("reviewer_id");
CREATE INDEX "translation_review_history_reviewed_at_idx" ON "public"."translation_review_history" ("reviewed_at" DESC);

-- Review notifications indexes
CREATE INDEX "review_notifications_user_id_idx" ON "public"."review_notifications" ("user_id");
CREATE INDEX "review_notifications_is_read_idx" ON "public"."review_notifications" ("is_read");
CREATE INDEX "review_notifications_created_at_idx" ON "public"."review_notifications" ("created_at" DESC);


-- ====================================
-- COMMENTS
-- ====================================

COMMENT ON TABLE "public"."departments" IS 'Organization departments for user categorization';
COMMENT ON TABLE "public"."languages" IS 'Available languages for translation and review';
COMMENT ON TABLE "public"."user_edit_languages" IS 'User permissions for editing specific languages';
COMMENT ON TABLE "public"."user_review_languages" IS 'User permissions for reviewing specific languages';
COMMENT ON TABLE "public"."users" IS 'System users with role-based access';
COMMENT ON TABLE "public"."translation_data" IS 'Core translation data without review information';
COMMENT ON TABLE "public"."translation_reviews" IS 'Translation review workflow data';
COMMENT ON TABLE "public"."translation_review_history" IS 'Complete audit trail of translation reviews';
COMMENT ON TABLE "public"."review_notifications" IS 'Review-related notifications for users';

COMMENT ON COLUMN "public"."translation_reviews"."review_status" IS 'Current status in the review workflow';
COMMENT ON COLUMN "public"."translation_reviews"."priority" IS 'Review queue priority (1=very low, 2=low, 3=normal, 4=high, 5=very high)';

