-- ============================================================================
-- 사용자 데이터 삭제 스크립트
-- User: wks0968@gmail.com (7a763b52-990e-41ed-9263-4514fff9bc8a)
-- Workspace: 이철희의 워크스페이스 (a5262c65-5ae5-4ca1-a0a8-a972cabf010e)
-- ============================================================================
-- 사용법:
-- 1. USER_ID와 WORKSPACE_ID를 실제 값으로 변경
-- 2. docker exec send-grid-test-postgres-1 psql -U postgres -d postgres -f /path/to/delete-user-data.sql
-- ============================================================================

BEGIN;

-- 변수 설정 (실제 사용 시 변경 필요)
-- User ID: 7a763b52-990e-41ed-9263-4514fff9bc8a
-- Workspace ID: a5262c65-5ae5-4ca1-a0a8-a972cabf010e

-- 1. leads 관련 테이블 삭제
DELETE FROM lead_contacts WHERE lead_id IN (SELECT id FROM leads WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM lead_products WHERE lead_id IN (SELECT id FROM leads WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM lead_social_media WHERE lead_id IN (SELECT id FROM leads WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM lead_business_sectors WHERE lead_id IN (SELECT id FROM leads WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM lead_industry_types WHERE lead_id IN (SELECT id FROM leads WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM lead_product_categories WHERE lead_id IN (SELECT id FROM leads WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM leads WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 2. emails 관련 테이블 삭제
DELETE FROM email_events WHERE email_id IN (SELECT id FROM emails WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM email_replies WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM emails WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 3. sequences 관련 테이블 삭제
DELETE FROM sequence_step_executions WHERE enrollment_id IN (SELECT id FROM sequence_enrollments WHERE sequence_id IN (SELECT id FROM sequences WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e'));
DELETE FROM sequence_enrollments WHERE sequence_id IN (SELECT id FROM sequences WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM sequence_steps WHERE sequence_id IN (SELECT id FROM sequences WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM sequences WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 4. chat 관련 테이블 삭제
DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM chat_conversations WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 5. customer_groups 관련 테이블 삭제
DELETE FROM customer_group_members WHERE group_id IN (SELECT id FROM customer_groups WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM customer_groups WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 6. websets 관련 테이블 삭제
DELETE FROM webset_rows WHERE webset_id IN (SELECT id FROM websets WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM websets WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 7. IAM 관련 테이블 삭제
DELETE FROM iam_member_policies WHERE member_id IN (SELECT id FROM workspace_members WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM iam_member_roles WHERE member_id IN (SELECT id FROM workspace_members WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM iam_role_policies WHERE role_id IN (SELECT id FROM iam_workspace_roles WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM iam_policy_statements WHERE policy_id IN (SELECT id FROM iam_policies WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e');
DELETE FROM iam_policies WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM iam_workspace_roles WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM iam_audit_logs WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM iam_audit_logs WHERE user_id = '7a763b52-990e-41ed-9263-4514fff9bc8a';

-- 8. 기타 workspace 관련 테이블 삭제
DELETE FROM email_signatures WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM email_templates WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM user_email_accounts WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM openai_api_keys WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM onboarding_progress WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM activity_logs WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM subscriptions WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM workspace_products WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';
DELETE FROM workspace_sales_strategies WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 9. workspace_members 삭제
DELETE FROM workspace_members WHERE workspace_id = 'a5262c65-5ae5-4ca1-a0a8-a972cabf010e';

-- 10. 사용자 관련 테이블 삭제
DELETE FROM billing_customers WHERE user_id = '7a763b52-990e-41ed-9263-4514fff9bc8a';
DELETE FROM user_signature_preferences WHERE user_id = '7a763b52-990e-41ed-9263-4514fff9bc8a';
DELETE FROM activity_logs WHERE user_id = '7a763b52-990e-41ed-9263-4514fff9bc8a';

-- 11. workspaces 삭제
DELETE FROM workspaces WHERE owner_id = '7a763b52-990e-41ed-9263-4514fff9bc8a';

-- 12. 최종: users 테이블에서 사용자 삭제
DELETE FROM users WHERE id = '7a763b52-990e-41ed-9263-4514fff9bc8a';

COMMIT;
