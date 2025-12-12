-- ============================================================================
-- IAM Policies Seed Data (AWS IAM 표준)
-- ============================================================================
--
-- 이 파일은 IAM 정책 및 정책 명세를 표준화된 형태로 정의합니다.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │                    Policy Statement 구조                                │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │                                                                         │
-- │  resources: 대상 리소스 배열                                            │
-- │    - "leads", "sequences", "emails" 등 단일 리소스                     │
-- │    - "leads:*" 리드 및 모든 하위 리소스                                 │
-- │    - "*" 모든 리소스                                                    │
-- │                                                                         │
-- │  actions: 허용/거부할 액션 배열                                         │
-- │    - "list", "read", "create", "update", "delete" 기본 CRUD            │
-- │    - "execute", "send", "export", "import" 특수 액션                   │
-- │    - "manage" = list + read + create + update + delete                 │
-- │    - "*" 모든 액션                                                      │
-- │                                                                         │
-- │  effect: "allow" (허용) 또는 "deny" (거부)                              │
-- │    - deny는 항상 allow보다 우선                                         │
-- │                                                                         │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- 실행 방법:
-- psql -h localhost -U postgres -d postgres -f drizzle/seed-iam-policies.sql
-- ============================================================================

-- 트랜잭션 시작
BEGIN;

-- ============================================================================
-- 1. 기존 Policy Statements 삭제 (managed 정책만)
-- ============================================================================

DELETE FROM iam_policy_statements
WHERE policy_id IN (
  SELECT id FROM iam_policies WHERE is_managed = true
);

-- ============================================================================
-- 2. TierBoundary:Trial (체험판 - Level 1)
-- ============================================================================
-- 제한적 기능: 대시보드 읽기, 인박스 읽기(5회), 프로필 설정만
-- ⚠️ Trial 사용자 메뉴: 홈, 인박스만 표시

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
-- 허용: 대시보드 읽기
('00000000-0000-0000-0003-000000000001', 'TrialDashboard', 'allow',
 ARRAY['dashboard'],
 ARRAY['read', 'list'],
 100),

-- 허용: 인박스 읽기 (조건으로 5회 제한은 별도 로직)
('00000000-0000-0000-0003-000000000001', 'TrialInbox', 'allow',
 ARRAY['emails'],
 ARRAY['read', 'list'],
 100),

-- 허용: 설정 (기본 설정만)
('00000000-0000-0000-0003-000000000001', 'TrialSettings', 'allow',
 ARRAY['settings', 'settings:profile', 'settings:workspace', 'email-templates'],
 ARRAY['read', 'update'],
 100),

-- 거부: 분석 기능 (Basic 이상만)
('00000000-0000-0000-0003-000000000001', 'TrialDenyAnalytics', 'deny',
 ARRAY['analytics'],
 ARRAY['*'],
 200),

-- 거부: Pro 기능 (고객탐색, 고객관리, 캠페인)
('00000000-0000-0000-0003-000000000001', 'TrialDenyProFeatures', 'deny',
 ARRAY['leads:discovery', 'leads', 'leads:*', 'customer-groups', 'sequences', 'sequences:*'],
 ARRAY['*'],
 200),

-- 거부: AI 챗봇 (Enterprise 전용)
('00000000-0000-0000-0003-000000000001', 'TrialDenyChatbot', 'deny',
 ARRAY['ai:chatbot', 'ai:search'],
 ARRAY['*'],
 200);

-- ============================================================================
-- 3. TierBoundary:Basic (기본 - Level 2)
-- ============================================================================
-- 대시보드, 인박스 무제한

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
-- 허용: 대시보드
('00000000-0000-0000-0003-000000000002', 'BasicDashboard', 'allow',
 ARRAY['dashboard', 'analytics'],
 ARRAY['read', 'list'],
 100),

-- 허용: 인박스 무제한
('00000000-0000-0000-0003-000000000002', 'BasicInbox', 'allow',
 ARRAY['emails', 'emails:*'],
 ARRAY['read', 'list', 'update'],
 100),

-- 허용: 설정
('00000000-0000-0000-0003-000000000002', 'BasicSettings', 'allow',
 ARRAY['settings', 'settings:*'],
 ARRAY['read', 'update'],
 100),

-- 거부: Pro 기능
('00000000-0000-0000-0003-000000000002', 'BasicDenyProFeatures', 'deny',
 ARRAY['leads:discovery', 'leads', 'leads:*', 'customer-groups', 'sequences', 'sequences:*'],
 ARRAY['*'],
 200),

-- 거부: AI 챗봇
('00000000-0000-0000-0003-000000000002', 'BasicDenyChatbot', 'deny',
 ARRAY['ai:chatbot', 'ai:search'],
 ARRAY['*'],
 200);

-- ============================================================================
-- 4. TierBoundary:Pro (프로 - Level 3)
-- ============================================================================
-- 고객탐색, 고객관리, 캠페인 - 셀프 서빙

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
-- 허용: 대시보드 & 분석
('00000000-0000-0000-0003-000000000003', 'ProDashboard', 'allow',
 ARRAY['dashboard', 'analytics'],
 ARRAY['*'],
 100),

-- 허용: 고객 탐색
('00000000-0000-0000-0003-000000000003', 'ProLeadDiscovery', 'allow',
 ARRAY['leads:discovery'],
 ARRAY['*'],
 100),

-- 허용: 고객 관리
('00000000-0000-0000-0003-000000000003', 'ProLeads', 'allow',
 ARRAY['leads', 'leads:*', 'customer-groups', 'customer-groups:*'],
 ARRAY['*'],
 100),

-- 허용: 캠페인
('00000000-0000-0000-0003-000000000003', 'ProSequences', 'allow',
 ARRAY['sequences', 'sequences:*'],
 ARRAY['*'],
 100),

-- 허용: 이메일
('00000000-0000-0000-0003-000000000003', 'ProEmails', 'allow',
 ARRAY['emails', 'emails:*', 'email-templates', 'email-accounts', 'bulk-email'],
 ARRAY['*'],
 100),

-- 허용: 설정
('00000000-0000-0000-0003-000000000003', 'ProSettings', 'allow',
 ARRAY['settings', 'settings:*', 'workspaces:members'],
 ARRAY['*'],
 100),

-- 거부: AI 챗봇
('00000000-0000-0000-0003-000000000003', 'ProDenyChatbot', 'deny',
 ARRAY['ai:chatbot', 'ai:search'],
 ARRAY['*'],
 200);

-- ============================================================================
-- 5. TierBoundary:Enterprise (엔터프라이즈 - Level 4)
-- ============================================================================
-- 모든 기능 사용 가능 (Rinda GPT 포함)

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
-- 허용: 대시보드 & 분석
('00000000-0000-0000-0003-000000000004', 'EnterpriseDashboard', 'allow',
 ARRAY['dashboard', 'analytics'],
 ARRAY['*'],
 100),

-- 허용: 고객 탐색
('00000000-0000-0000-0003-000000000004', 'EnterpriseLeadDiscovery', 'allow',
 ARRAY['leads:discovery'],
 ARRAY['*'],
 100),

-- 허용: 고객 관리
('00000000-0000-0000-0003-000000000004', 'EnterpriseLeads', 'allow',
 ARRAY['leads', 'leads:*', 'customer-groups', 'customer-groups:*'],
 ARRAY['*'],
 100),

-- 허용: 캠페인
('00000000-0000-0000-0003-000000000004', 'EnterpriseSequences', 'allow',
 ARRAY['sequences', 'sequences:*'],
 ARRAY['*'],
 100),

-- 허용: 이메일
('00000000-0000-0000-0003-000000000004', 'EnterpriseEmails', 'allow',
 ARRAY['emails', 'emails:*', 'email-templates', 'email-accounts', 'bulk-email'],
 ARRAY['*'],
 100),

-- 허용: AI 챗봇 (Enterprise 전용)
('00000000-0000-0000-0003-000000000004', 'EnterpriseChatbot', 'allow',
 ARRAY['ai:chatbot', 'ai:search'],
 ARRAY['*'],
 100),

-- 허용: 설정
('00000000-0000-0000-0003-000000000004', 'EnterpriseSettings', 'allow',
 ARRAY['settings', 'settings:*', 'workspaces:members'],
 ARRAY['*'],
 100);

-- ============================================================================
-- 6. WorkspaceOwner (워크스페이스 소유자)
-- ============================================================================
-- 워크스페이스 내 모든 리소스에 대한 전체 권한

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
('00000000-0000-0000-0003-000000000010', 'OwnerFullAccess', 'allow',
 ARRAY['*'],
 ARRAY['*'],
 100);

-- ============================================================================
-- 7. WorkspaceAdmin (워크스페이스 관리자)
-- ============================================================================
-- 대부분의 리소스 관리 가능, 워크스페이스 삭제 불가

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
-- 허용: 모든 비즈니스 리소스 관리
('00000000-0000-0000-0003-000000000011', 'AdminManageResources', 'allow',
 ARRAY[
   'dashboard', 'analytics',
   'leads:discovery',
   'leads', 'leads:*',
   'customer-groups', 'customer-groups:*',
   'sequences', 'sequences:*',
   'emails', 'emails:*', 'email-templates', 'email-accounts', 'bulk-email',
   'ai:chatbot', 'ai:search',
   'settings', 'settings:*'
 ],
 ARRAY['*'],
 100),

-- 허용: 멤버 관리
('00000000-0000-0000-0003-000000000011', 'AdminManageMembers', 'allow',
 ARRAY['workspaces:members'],
 ARRAY['list', 'read', 'create', 'update', 'invite'],
 100),

-- 거부: 워크스페이스 삭제
('00000000-0000-0000-0003-000000000011', 'AdminDenyDeleteWorkspace', 'deny',
 ARRAY['workspaces'],
 ARRAY['delete'],
 200);

-- ============================================================================
-- 8. WorkspaceMember (워크스페이스 멤버)
-- ============================================================================
-- 기본적인 업무 수행 가능, 자신의 리소스만 관리

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
-- 허용: 대시보드 & 분석 읽기
('00000000-0000-0000-0003-000000000012', 'MemberReadDashboard', 'allow',
 ARRAY['dashboard', 'analytics'],
 ARRAY['read', 'list'],
 100),

-- 허용: 고객 탐색 읽기
('00000000-0000-0000-0003-000000000012', 'MemberReadLeadDiscovery', 'allow',
 ARRAY['leads:discovery'],
 ARRAY['read', 'list', 'execute'],
 100),

-- 허용: 고객 관리 읽기
('00000000-0000-0000-0003-000000000012', 'MemberReadLeads', 'allow',
 ARRAY['leads', 'customer-groups'],
 ARRAY['read', 'list'],
 100),

-- 허용: 자신의 리드 관리
('00000000-0000-0000-0003-000000000012', 'MemberManageOwnLeads', 'allow',
 ARRAY['leads:own'],
 ARRAY['create', 'update', 'delete'],
 100),

-- 허용: 캠페인 읽기
('00000000-0000-0000-0003-000000000012', 'MemberReadSequences', 'allow',
 ARRAY['sequences'],
 ARRAY['read', 'list'],
 100),

-- 허용: 자신의 캠페인 관리
('00000000-0000-0000-0003-000000000012', 'MemberManageOwnSequences', 'allow',
 ARRAY['sequences:own'],
 ARRAY['create', 'update', 'delete', 'execute'],
 100),

-- 허용: 이메일 읽기
('00000000-0000-0000-0003-000000000012', 'MemberReadEmails', 'allow',
 ARRAY['emails'],
 ARRAY['read', 'list'],
 100),

-- 허용: 자신의 이메일 관리
('00000000-0000-0000-0003-000000000012', 'MemberManageOwnEmails', 'allow',
 ARRAY['emails:own'],
 ARRAY['create', 'update', 'delete', 'send'],
 100),

-- 허용: AI 챗봇 사용
('00000000-0000-0000-0003-000000000012', 'MemberUseChatbot', 'allow',
 ARRAY['ai:chatbot'],
 ARRAY['read', 'execute'],
 100),

-- 허용: 설정/프로필/워크스페이스/이메일템플릿 (읽기 + 프로필 수정)
('00000000-0000-0000-0003-000000000012', 'MemberSettings', 'allow',
 ARRAY['settings', 'settings:profile', 'settings:workspace', 'email-templates'],
 ARRAY['read', 'update'],
 100),

-- 거부: 멤버 관리 및 워크스페이스 설정
('00000000-0000-0000-0003-000000000012', 'MemberDenyAdmin', 'deny',
 ARRAY['workspaces:members', 'settings:workspace'],
 ARRAY['create', 'update', 'delete', 'invite'],
 200);

-- ============================================================================
-- 9. WorkspaceViewer (워크스페이스 뷰어)
-- ============================================================================
-- 읽기 전용

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
-- 허용: 모든 비즈니스 리소스 읽기
('00000000-0000-0000-0003-000000000013', 'ViewerReadAll', 'allow',
 ARRAY[
   'dashboard', 'analytics',
   'leads:discovery',
   'leads', 'customer-groups',
   'sequences',
   'emails',
   'settings'
 ],
 ARRAY['read', 'list'],
 100),

-- 거부: 모든 쓰기 작업
('00000000-0000-0000-0003-000000000013', 'ViewerDenyWrite', 'deny',
 ARRAY['*'],
 ARRAY['create', 'update', 'delete', 'execute', 'send', 'import', 'export', 'invite'],
 200);

-- ============================================================================
-- 10. SystemAdmin (시스템 관리자 - Level 5)
-- ============================================================================
-- 모든 워크스페이스 및 사용자 관리

INSERT INTO iam_policy_statements (policy_id, sid, effect, resources, actions, priority) VALUES
('00000000-0000-0000-0003-000000000020', 'SystemAdminFullAccess', 'allow',
 ARRAY['*'],
 ARRAY['*'],
 100),

('00000000-0000-0000-0003-000000000020', 'SystemAdminIAM', 'allow',
 ARRAY['iam:policies', 'iam:roles', 'iam:members', 'iam:audit'],
 ARRAY['*'],
 100),

('00000000-0000-0000-0003-000000000020', 'SystemAdminBilling', 'allow',
 ARRAY['billing', 'billing:*'],
 ARRAY['*'],
 100);

-- 트랜잭션 커밋
COMMIT;

-- ============================================================================
-- 확인 쿼리
-- ============================================================================

-- 정책별 statements 확인
SELECT
  ip.name as policy_name,
  ips.sid,
  ips.effect,
  ips.resources,
  ips.actions,
  ips.priority
FROM iam_policies ip
JOIN iam_policy_statements ips ON ip.id = ips.policy_id
WHERE ip.is_managed = true
ORDER BY ip.name, ips.priority DESC, ips.effect DESC;
