-- Migration: email-signatures-workspace-required
-- 서명을 워크스페이스별로 관리하도록 스키마 변경

ALTER TABLE "email_signatures" DROP CONSTRAINT "email_signatures_workspace_id_workspaces_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "unique_user_signature";
--> statement-breakpoint
ALTER TABLE "email_signatures" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
-- 1. workspace_id 컬럼을 nullable로 먼저 추가
ALTER TABLE "user_signature_preferences" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
-- 2. 기존 데이터에 workspace_id 할당 (서명의 workspace_id 사용)
UPDATE user_signature_preferences usp
SET workspace_id = es.workspace_id
FROM email_signatures es
WHERE usp.signature_id = es.id AND usp.workspace_id IS NULL;
--> statement-breakpoint
-- 3. 할당 안된 row 삭제 (서명이 삭제된 경우)
DELETE FROM user_signature_preferences WHERE workspace_id IS NULL;
--> statement-breakpoint
-- 4. NOT NULL 제약조건 적용
ALTER TABLE "user_signature_preferences" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_signature_preferences" ADD CONSTRAINT "user_signature_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_user_signature_preferences_workspace_id" ON "user_signature_preferences" USING btree ("workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_workspace_signature" ON "user_signature_preferences" USING btree ("user_id","workspace_id");
