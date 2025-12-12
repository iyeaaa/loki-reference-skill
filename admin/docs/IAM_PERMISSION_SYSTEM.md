# IAM 권한 관리 시스템 가이드

> AWS IAM 스타일의 권한 관리 시스템 구현 및 사용 가이드

## 목차

1. [개요](#개요)
2. [핵심 개념](#핵심-개념)
3. [역할(Role) vs 정책(Policy) 차이](#역할role-vs-정책policy-차이)
4. [권한 평가 순서](#권한-평가-순서)
5. [기본 역할 템플릿](#기본-역할-템플릿)
6. [사용 시나리오](#사용-시나리오)
7. [권장 사항](#권장-사항)
8. [데이터베이스 스키마](#데이터베이스-스키마)
9. [API 엔드포인트](#api-엔드포인트)
10. [UI/UX 변경사항](#uiux-변경사항)
11. [메뉴별 권한 정책](#메뉴별-권한-정책)

---

## 개요

본 시스템은 AWS IAM을 참고하여 설계된 세분화된 권한 관리 시스템입니다. 워크스페이스 단위로 역할과 정책을 관리하며, 구독 등급(Tier)에 따른 권한 경계(Boundary)를 지원합니다.

### 주요 특징

- **역할 기반 접근 제어 (RBAC)**: 역할에 정책을 연결하고, 멤버에게 역할 부여
- **직접 정책 연결**: 예외적인 경우 멤버에게 직접 정책 할당 가능
- **등급별 권한 경계**: 구독 등급(trial, basic, pro, enterprise)에 따른 최대 권한 제한
- **감사 로그**: 모든 IAM 관련 변경사항 기록

---

## 핵심 개념

### 정책 (Policy)

권한의 집합을 정의하는 문서입니다. 어떤 리소스에 대해 어떤 액션을 허용/거부할지 명시합니다.

```json
{
  "statements": [
    {
      "effect": "allow",
      "resources": ["leads", "sequences"],
      "actions": ["read", "create", "update"]
    },
    {
      "effect": "deny",
      "resources": ["settings"],
      "actions": ["delete"]
    }
  ]
}
```

### 역할 (Role)

정책들의 묶음입니다. 여러 정책을 하나의 역할로 그룹화하여 관리 편의성을 높입니다.

| 역할 | 연결된 정책 | 설명 |
|------|------------|------|
| Owner | WorkspaceOwner | 모든 권한 |
| Admin | WorkspaceAdmin | 멤버 관리 가능, 워크스페이스 삭제 불가 |
| Member | WorkspaceMember | 기본 업무 수행 |
| Viewer | WorkspaceViewer | 읽기 전용 |

### 등급 경계 (Tier Boundary)

구독 등급에 따른 최대 권한을 제한합니다. 역할이나 정책으로 권한을 부여해도 등급 경계를 넘을 수 없습니다.

| 등급 | 제한사항 |
|------|---------|
| Trial | 리드 20개, 성과지표 제한, 캠페인 실행 불가 |
| Basic | Linda GPT 제한 |
| Pro | Linda GPT 제한 |
| Enterprise | 모든 기능 사용 가능 |

---

## 역할(Role) vs 정책(Policy) 차이

### 비교표

| 구분 | 역할 (Role) | 직접 정책 (Policy) |
|------|------------|-------------------|
| **용도** | 일반적인 권한 관리 | 예외적인 권한 부여/제한 |
| **관리** | 쉬움 (그룹화) | 개별 관리 필요 |
| **유연성** | 표준화된 권한 세트 | 개인별 맞춤 권한 |
| **권장** | 기본 사용 권장 | 특수 케이스에만 사용 |
| **예시** | Admin, Member, Viewer | 특정 기능 차단, 임시 권한 |

### 역할 기반 권한 관리 (권장)

```
멤버 → 역할(Admin) → 정책(WorkspaceAdmin) → 권한들
```

장점:
- 일관된 권한 관리
- 역할 변경 시 자동으로 모든 연결된 멤버에게 적용
- 관리 포인트 단순화

### 직접 정책 연결 (예외 상황)

```
멤버 → 정책(CustomRestriction) → 권한 제한
```

사용 사례:
- 특정 멤버에게만 추가 권한 부여
- 특정 멤버의 일부 기능 차단
- 임시 권한 부여

---

## 권한 평가 순서

권한 요청 시 다음 순서로 평가됩니다:

```
1. Super Admin 체크
   └─ is_super_admin = true → 전체 허용

2. 워크스페이스 멤버십 체크
   └─ 멤버가 아님 → 거부

3. Tier Boundary 체크
   └─ 등급 경계 위반 → 거부

4. Explicit Deny 체크
   └─ 명시적 거부 → 거부

5. Explicit Allow 체크
   └─ 명시적 허용 → 허용

6. Default
   └─ 기본 거부
```

### 평가 예시

**시나리오**: Basic 등급 워크스페이스의 Admin 멤버가 Linda GPT 사용 시도

1. Super Admin? → No
2. 멤버십? → Yes (Admin)
3. Tier Boundary? → Basic에서 Linda GPT는 Deny → **거부됨**

---

## 기본 역할 템플릿

워크스페이스 생성 시 자동으로 4개의 기본 역할이 생성됩니다.

### Owner (소유자)

```typescript
{
  name: "Owner",
  priority: 100,
  isSystem: true,
  isDefault: false,
  policy: "WorkspaceOwner"
}
```

권한:
- 모든 리소스에 대한 전체 권한
- 워크스페이스 삭제
- 멤버 역할 변경
- 결제 정보 관리

### Admin (관리자)

```typescript
{
  name: "Admin",
  priority: 80,
  isSystem: true,
  isDefault: false,
  policy: "WorkspaceAdmin"
}
```

권한:
- 멤버 초대/제거
- 대부분의 설정 변경
- 워크스페이스 삭제 불가

### Member (멤버)

```typescript
{
  name: "Member",
  priority: 50,
  isSystem: true,
  isDefault: true,  // 새 멤버 자동 할당
  policy: "WorkspaceMember"
}
```

권한:
- 기본적인 업무 수행
- 자신의 리소스 관리
- 리드/시퀀스/캠페인 CRUD

### Viewer (뷰어)

```typescript
{
  name: "Viewer",
  priority: 10,
  isSystem: true,
  isDefault: false,
  policy: "WorkspaceViewer"
}
```

권한:
- 모든 리소스 조회
- 수정/삭제 불가

---

## 사용 시나리오

### 시나리오 1: 새 멤버 초대

```
1. 워크스페이스에 새 멤버 초대
2. 자동으로 "Member" 역할 할당 (isDefault = true)
3. WorkspaceMember 정책의 권한 적용
```

### 시나리오 2: 멤버 역할 변경

```
1. Admin이 멤버의 역할을 "Admin"으로 변경
2. 기존 IAM 역할 자동 동기화 (syncMemberRoleToIamRole)
3. WorkspaceAdmin 정책의 권한 적용
```

### 시나리오 3: 특정 멤버 기능 제한

```
1. 멤버에게 "Member" 역할 유지
2. 추가로 "DenyAnalytics" 정책 직접 연결
3. 분석 기능만 제한, 나머지는 Member 권한 유지
```

### 시나리오 4: 임시 권한 부여

```
1. Viewer 역할의 멤버가 있음
2. 프로젝트 기간 동안만 "TemporaryEdit" 정책 직접 연결
3. 프로젝트 종료 후 정책 해제
```

### 시나리오 5: 외부 협력사

```
1. 외부 협력사 직원 멤버 초대
2. "Viewer" 역할 할당
3. "AllowSpecificLeads" 정책 직접 연결
4. 특정 리드만 조회 가능하도록 설정
```

---

## 권장 사항

### 1. 역할 중심 관리

- 대부분의 경우 **역할**을 통한 권한 관리 권장
- 직접 정책 연결은 예외 상황에만 사용
- 역할 변경만으로 권한 조정 가능하도록 설계

### 2. 최소 권한 원칙

- 필요한 최소한의 권한만 부여
- Viewer로 시작 → 필요시 Member → Admin 순으로 승격

### 3. 정기적인 감사

- 감사 로그를 주기적으로 검토
- 불필요한 직접 정책 연결 정리
- 역할 할당 현황 모니터링

### 4. 역할 우선순위 활용

- 높은 priority 역할의 권한이 우선 적용
- Owner(100) > Admin(80) > Member(50) > Viewer(10)

---

## 데이터베이스 스키마

### 핵심 테이블

```sql
-- 정책 정의
iam_policies
├── id (UUID)
├── workspace_id (NULL = 시스템 정책)
├── name
├── description
├── is_managed (시스템 관리 여부)
└── is_active

-- 정책 명세서
iam_policy_statements
├── policy_id
├── effect (allow/deny)
├── resources (TEXT[])
├── actions (TEXT[])
├── conditions (JSONB)
└── priority

-- 워크스페이스 역할
iam_workspace_roles
├── workspace_id
├── name
├── is_default (새 멤버 자동 할당)
├── is_system (시스템 역할 여부)
└── priority

-- 역할 ↔ 정책 연결
iam_role_policies (N:M)
├── role_id
└── policy_id

-- 멤버 ↔ 역할 할당
iam_member_roles (N:M)
├── member_id
└── role_id

-- 멤버 직접 정책
iam_member_policies (N:M)
├── member_id
└── policy_id

-- 등급별 권한 경계
iam_tier_boundaries
├── tier (trial/basic/pro/enterprise)
└── policy_id

-- 감사 로그
iam_audit_logs
├── action
├── target_type
├── target_id
├── old_value (JSONB)
└── new_value (JSONB)
```

### 관계도

```
workspace_members
       │
       ├───────────────────┐
       │                   │
       ▼                   ▼
iam_member_roles     iam_member_policies
       │                   │
       ▼                   │
iam_workspace_roles        │
       │                   │
       ▼                   ▼
iam_role_policies ───► iam_policies ◄─── iam_tier_boundaries
                            │
                            ▼
                   iam_policy_statements
```

---

## API 엔드포인트

### 역할 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/iam/roles` | 워크스페이스 역할 목록 |
| POST | `/iam/roles` | 새 역할 생성 |
| PATCH | `/iam/roles/:id` | 역할 수정 |
| DELETE | `/iam/roles/:id` | 역할 삭제 |

### 정책 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/iam/policies` | 정책 목록 (시스템 + 커스텀) |
| POST | `/iam/policies` | 새 정책 생성 |
| PATCH | `/iam/policies/:id` | 정책 수정 |
| DELETE | `/iam/policies/:id` | 정책 삭제 |

### 멤버 IAM 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/iam/members/:id/roles` | 멤버의 역할 목록 |
| POST | `/iam/members/:id/roles` | 멤버에 역할 할당 |
| DELETE | `/iam/members/:id/roles/:roleId` | 멤버 역할 해제 |
| GET | `/iam/members/:id/policies` | 멤버의 직접 정책 목록 |
| POST | `/iam/members/:id/policies` | 멤버에 정책 직접 연결 |
| DELETE | `/iam/members/:id/policies/:policyId` | 멤버 정책 해제 |

### 감사 로그

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/iam/audit-logs` | 감사 로그 조회 |

---

## UI/UX 변경사항

### 멤버 IAM 섹션

워크스페이스 멤버 관리 테이블에서 각 멤버별로 IAM 설정을 확장하여 볼 수 있습니다.

#### 역할 섹션

- **색상 코드**: 역할별 시각적 구분
  - Owner: 황금색 (`amber`)
  - Admin: 보라색 (`purple`)
  - Member: 파란색 (`blue`)
  - Viewer: 회색 (`gray`)

- **경고 표시**: 역할이 없는 멤버에게 경고 알림
- **툴팁**: 역할 개념 설명 제공

#### 정책 섹션

- **정보 박스**: 직접 정책 연결 시 주의사항 안내
- **시스템 정책 구분**: `is_managed` 표시
- **권장 사용법 안내**: 역할 기반 관리 권장 메시지

### 새로운 관리 페이지

1. **Tier Boundaries 페이지**: 등급별 권한 경계 관리
2. **Audit Logs 페이지**: IAM 감사 로그 조회 및 필터링
3. **Billing Customers 페이지**: 결제 고객 정보 관리

---

## 메뉴별 권한 정책

> 사이드바 및 설정 화면의 메뉴별 권한 매핑 현황

### 메인 사이드바 메뉴

메인 사이드바(`AppSidebar.tsx`)의 메뉴별 필요 권한입니다.

| 메뉴 | URL | Resource | Action | 권한 타입 |
|------|-----|----------|--------|-----------|
| **홈** | `/dashboard` | - | - | `public` |
| **분석** | `/analytics` | `analytics` | `read` | IAM 권한 |
| **고객 탐색** | `/lead-discovery` | `leads:discovery` | `read` | IAM 권한 |
| **고객 관리** | `/leads` | `leads` | `list` | IAM 권한 |
| **캠페인** | `/sequences` | `sequences` | `list` | IAM 권한 |
| **인박스** | `/replied-emails` | `emails` | `list` | IAM 권한 |
| **Rinda GPT** | `/chatbot` | `ai:chatbot` | `execute` | IAM 권한 |
| **설정** | `/settings` | - | - | `public` |

#### 필터링 규칙

```typescript
// AppSidebar.tsx:220-242
if (item.permission === "public") return true      // 모든 로그인 사용자
if (!item.permission) return false                  // Admin만 (보안 우선)
return hasPermission(resource, action)              // IAM 권한 체크
```

---

### 설정 화면 사이드바 메뉴

설정 페이지(`settings.tsx`)의 메뉴별 필요 권한입니다.

#### 개인 설정 섹션

| 메뉴 | Resource | Action | 권한 타입 | 대상 |
|------|----------|--------|-----------|------|
| **프로필** | `settings:profile` | `read` | IAM 권한 | 모든 사용자 |
| **서명** | `settings:profile` | `read` | IAM 권한 | 모든 사용자 |

#### 워크스페이스 섹션

| 메뉴 | Resource | Action | 권한 타입 | 대상 |
|------|----------|--------|-----------|------|
| **회사 설정** | - | - | `public` | 온보딩 미완료 시만 |
| **워크스페이스** | `settings:workspace` | `read` | IAM 권한 | Owner/Admin |
| **이메일 템플릿** | `email-templates` | `list` | IAM 권한 | 템플릿 조회 권한자 |

#### 시스템 관리 섹션 (Admin Only)

| 메뉴 | Resource | Action | 권한 타입 | 대상 |
|------|----------|--------|-----------|------|
| **사용자 관리** | - | - | `admin-only` | 시스템 Admin |
| **대량 리드 가져오기** | `leads` | `import` | IAM 권한 | 리드 가져오기 권한자 |
| **웹 데이터 추출** | - | - | `admin-only` | 시스템 Admin |
| **Nylas 테스트** | - | - | `admin-only` | 시스템 Admin |

#### 결제 섹션 (Admin Only)

| 메뉴 | Resource | Action | 권한 타입 | 대상 |
|------|----------|--------|-----------|------|
| **상품** | - | - | `admin-only` | 시스템 Admin |
| **요금제** | - | - | `admin-only` | 시스템 Admin |
| **구독** | - | - | `admin-only` | 시스템 Admin |
| **고객** | - | - | `admin-only` | 시스템 Admin |

#### 권한 및 보안 섹션 (Admin Only)

| 메뉴 | Resource | Action | 권한 타입 | 대상 |
|------|----------|--------|-----------|------|
| **정책** | - | - | `admin-only` | 시스템 Admin |
| **역할** | - | - | `admin-only` | 시스템 Admin |
| **등급 경계** | - | - | `admin-only` | 시스템 Admin |
| **감사 로그** | - | - | `admin-only` | 시스템 Admin |
| **활동 로그** | - | - | `admin-only` | 시스템 Admin |

---

### 권한 타입 설명

| 권한 타입 | 설명 | 판단 기준 |
|-----------|------|-----------|
| `public` | 모든 로그인 사용자 | 인증 여부만 체크 |
| `admin-only` | 시스템 Admin만 | `users.role = 'admin' \| 'super_admin'` |
| IAM 권한 | 특정 권한 보유자 | `hasPermission(resource, action)` |

---

### 역할별 메뉴 접근 권한

#### 시스템 Admin

```
✅ 메인 사이드바: 모든 메뉴
✅ 설정 사이드바: 모든 메뉴
   - 개인 설정 (프로필, 서명)
   - 워크스페이스 (회사설정, 워크스페이스, 이메일템플릿)
   - 시스템 관리 (사용자관리, 대량가져오기, 웹추출, Nylas테스트)
   - 결제 (상품, 요금제, 구독, 고객)
   - 권한 및 보안 (정책, 역할, 등급경계, 감사로그, 활동로그)
```

#### Workspace Owner / Admin

```
✅ 메인 사이드바: TierBoundary 정책에 따름
   - Enterprise: 모든 메뉴
   - Pro: Rinda GPT 제외
   - Basic: 홈, 분석, 인박스만
   - Trial: 홈, 인박스만

✅ 설정 사이드바:
   - 개인 설정 (프로필, 서명)
   - 워크스페이스 (워크스페이스, 이메일템플릿)
❌ 시스템 관리, 결제, 권한보안 숨김
```

#### Workspace Member

```
✅ 메인 사이드바: TierBoundary + Member 정책에 따름
   - 기본: 읽기 권한 위주
   - 자신의 리소스만 생성/수정/삭제

✅ 설정 사이드바:
   - 개인 설정 (프로필, 서명)
❌ 워크스페이스, 시스템관리, 결제, 권한보안 숨김
```

#### Workspace Viewer

```
✅ 메인 사이드바: 읽기 전용 메뉴만
   - 홈, 분석 (TierBoundary 허용 시)

✅ 설정 사이드바:
   - 개인 설정 (프로필만, 읽기전용)
❌ 대부분의 메뉴 숨김
```

#### Trial 사용자

```
✅ 메인 사이드바: (TierBoundary:Trial)
   - 홈 (dashboard:read)
   - 인박스 (emails:read, emails:list - 5회 제한)
❌ 분석, 고객탐색, 고객관리, 캠페인, Rinda GPT 숨김

✅ 설정 사이드바:
   - 프로필 (settings:profile:read, settings:profile:update)
❌ 서명, 워크스페이스, 시스템관리, 결제, 권한보안 숨김
```

---

### DB Policy Statements (역할별)

#### TierBoundary:Trial (Level 1)

```sql
-- 허용
('TrialDashboard', 'allow', '{dashboard}', '{read,list}')
('TrialInbox', 'allow', '{emails}', '{read,list}')
('TrialProfile', 'allow', '{settings:profile}', '{read,update}')

-- 거부
('TrialDenyProFeatures', 'deny', '{leads:discovery,leads,leads:*,customer-groups,sequences,sequences:*}', '{*}')
('TrialDenyChatbot', 'deny', '{ai:chatbot,ai:search}', '{*}')
```

#### TierBoundary:Basic (Level 2)

```sql
-- 허용
('BasicDashboard', 'allow', '{dashboard,analytics}', '{read,list}')
('BasicInbox', 'allow', '{emails,emails:*}', '{read,list,update}')
('BasicSettings', 'allow', '{settings,settings:*}', '{read,update}')

-- 거부
('BasicDenyProFeatures', 'deny', '{leads:discovery,leads,leads:*,customer-groups,sequences,sequences:*}', '{*}')
('BasicDenyChatbot', 'deny', '{ai:chatbot,ai:search}', '{*}')
```

#### TierBoundary:Pro (Level 3)

```sql
-- 허용
('ProDashboard', 'allow', '{dashboard,analytics}', '{*}')
('ProLeadDiscovery', 'allow', '{leads:discovery}', '{*}')
('ProLeads', 'allow', '{leads,leads:*,customer-groups,customer-groups:*}', '{*}')
('ProSequences', 'allow', '{sequences,sequences:*}', '{*}')
('ProEmails', 'allow', '{emails,emails:*,email-templates,email-accounts,bulk-email}', '{*}')
('ProSettings', 'allow', '{settings,settings:*,workspaces:members}', '{*}')

-- 거부
('ProDenyChatbot', 'deny', '{ai:chatbot,ai:search}', '{*}')
```

#### TierBoundary:Enterprise (Level 4)

```sql
-- 모든 기능 허용 (AI 챗봇 포함)
('EnterpriseDashboard', 'allow', '{dashboard,analytics}', '{*}')
('EnterpriseLeadDiscovery', 'allow', '{leads:discovery}', '{*}')
('EnterpriseLeads', 'allow', '{leads,leads:*,customer-groups,customer-groups:*}', '{*}')
('EnterpriseSequences', 'allow', '{sequences,sequences:*}', '{*}')
('EnterpriseEmails', 'allow', '{emails,emails:*,email-templates,email-accounts,bulk-email}', '{*}')
('EnterpriseChatbot', 'allow', '{ai:chatbot,ai:search}', '{*}')
('EnterpriseSettings', 'allow', '{settings,settings:*,workspaces:members}', '{*}')
```

#### WorkspaceMember

```sql
-- 읽기 권한
('MemberReadDashboard', 'allow', '{dashboard,analytics}', '{read,list}')
('MemberReadLeadDiscovery', 'allow', '{leads:discovery}', '{read,list,execute}')
('MemberReadLeads', 'allow', '{leads,customer-groups}', '{read,list}')
('MemberReadSequences', 'allow', '{sequences}', '{read,list}')
('MemberReadEmails', 'allow', '{emails}', '{read,list}')

-- 자신의 리소스 관리
('MemberManageOwnLeads', 'allow', '{leads:own}', '{create,update,delete}')
('MemberManageOwnSequences', 'allow', '{sequences:own}', '{create,update,delete,execute}')
('MemberManageOwnEmails', 'allow', '{emails:own}', '{create,update,delete,send}')

-- AI 챗봇
('MemberUseChatbot', 'allow', '{ai:chatbot}', '{read,execute}')

-- 설정
('MemberSettings', 'allow', '{settings,settings:profile}', '{read,update}')

-- 거부
('MemberDenyAdmin', 'deny', '{workspaces:members,settings:workspace}', '{create,update,delete,invite}')
```

---

### 라우트 권한 매핑 (`ROUTE_PERMISSIONS`)

```typescript
// admin/src/lib/permission/constants.ts

export const ROUTE_PERMISSIONS: Record<string, RoutePermission> = {
  // Dashboard & Analytics
  "/dashboard": "public",
  "/analytics": { resource: "analytics", action: "read" },

  // Leads & Customers
  "/leads": { resource: "leads", action: "list" },
  "/leads/:id": { resource: "leads", action: "read" },
  "/lead-discovery": { resource: "leads:discovery", action: "read" },
  "/lead-import": { resource: "leads", action: "import" },
  "/customer-groups": { resource: "customer-groups", action: "list" },

  // Campaigns
  "/sequences": { resource: "sequences", action: "list" },
  "/sequences/create": { resource: "sequences", action: "create" },
  "/sequences/edit": { resource: "sequences", action: "update" },
  "/sequences/:id": { resource: "sequences", action: "read" },
  "/sequences/:id/designer": { resource: "sequences", action: "update" },

  // Email
  "/replied-emails": { resource: "emails", action: "list" },
  "/replied-emails/:emailId": { resource: "emails", action: "read" },
  "/email-templates": { resource: "email-templates", action: "list" },
  "/bulk-email-csv": { resource: "bulk-email", action: "send" },

  // AI Features
  "/chatbot": { resource: "ai:chatbot", action: "execute" },

  // Settings
  "/settings": "public",
  "/settings/profile": { resource: "settings:profile", action: "read" },
  "/settings/workspace": { resource: "settings:workspace", action: "read" },
  "/settings/members": { resource: "workspaces:members", action: "list" },

  // Admin Only
  "/workspaces": "admin-only",
  "/users": "admin-only",
  "/activity-logs": "admin-only",
  "/iam/policies": "admin-only",
  "/iam/roles": "admin-only",
  "/billing/products": "admin-only",
  "/billing/plans": "admin-only",
  "/billing/subscriptions": "admin-only",

  // Test & Dev (Admin Only)
  "/email-send-test": "admin-only",
  "/tailwind-test": "admin-only",
  "/test/filters": "admin-only",
  "/test/sse": "admin-only",
  "/settings/spinner-test": "admin-only",
  "/settings/web-extraction": "admin-only",
  "/websets": "admin-only",
  "/gemini-search": "admin-only",
  "/bigquery-search": "admin-only",
}
```

---

## 변경 이력

### 2024-12-12

- `seed-iam.ts` 추가: 워크스페이스 생성 시 기본 역할 자동 생성
- `MemberIamSection.tsx` UI/UX 개선
  - 역할별 색상 코드 적용
  - 툴팁으로 개념 설명 추가
  - 경고/정보 알림 박스 추가
- `WorkspaceMembersSection.tsx` 업데이트
  - 멤버별 IAM 섹션 확장 기능
- 신규 관리 페이지 추가
  - `TierBoundariesPage.tsx`
  - `AuditLogsPage.tsx`
  - `CustomersPage.tsx`
