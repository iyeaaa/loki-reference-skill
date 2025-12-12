# feat/permission 브랜치 변경사항

> 브랜치: `feat/permission`
> 기간: 2025-12-12
> 총 커밋: 3개

---

## 커밋 요약

| 커밋 | 설명 | 변경 파일 수 |
|------|------|-------------|
| `c1d4b67` | Permission DB 스키마 설계 | 13개 (+10,540줄) |
| `0ddafa2` | AWS IAM 스타일 권한 시스템 구현 | 38개 (+12,580줄, -149줄) |
| `8a0786b` | Onboarding session storage → DB 이전 및 Company Setting 통합 | 71개 (+14,608줄, -1,662줄) |

---

## 1. Permission DB 스키마 설계 (`c1d4b67`)

### 새로운 문서
- `docs/PERMISSION_LEVEL_ACCESS_POLICY.md` - 레벨별 접근 정책 정의
- `docs/PERMISSION_SYSTEM_DESIGN.md` - DB 설계 문서
- `docs/PERMISSION_SYSTEM_ERD.puml` - ERD 다이어그램
- `docs/PERMISSION_WORKSPACE_VS_MEMBER.md` - 워크스페이스/멤버 권한 비교

### 새로운 DB 스키마 (Drizzle)

#### Billing 테이블
| 테이블 | 설명 |
|--------|------|
| `billing_customers` | 사용자 ↔ 외부 결제 고객 매핑 |
| `billing_products` | 상품 정의 (tier 매핑) |
| `billing_plans` | 요금제 (가격, 주기, 체험 기간) |
| `subscriptions` | 워크스페이스 단위 구독 관리 |

#### IAM 테이블
| 테이블 | 설명 |
|--------|------|
| `iam_policies` | 정책 정의 (시스템/워크스페이스) |
| `iam_policy_statements` | Allow/Deny 명세 (리소스, 액션, 조건) |
| `iam_workspace_roles` | 워크스페이스 역할 (Owner, Admin, Editor, Viewer) |
| `iam_role_policies` | 역할 ↔ 정책 연결 |
| `iam_member_roles` | 멤버 ↔ 역할 할당 |
| `iam_member_policies` | 멤버 직접 정책 (인라인) |
| `iam_tier_boundaries` | 등급별 Permission Boundary |
| `iam_audit_logs` | 감사 로그 |

#### 새로운 Enum 타입
```sql
-- 구독 등급
subscription_tier_enum: 'trial' | 'basic' | 'pro' | 'enterprise'

-- 구독 상태
subscription_status_enum: 'trialing' | 'active' | 'canceled' | 'incomplete' | ...

-- 요금제 타입
plan_type_enum: 'one_time' | 'recurring'
plan_interval_enum: 'day' | 'week' | 'month' | 'year'

-- 정책 효과
policy_effect_enum: 'allow' | 'deny'
```

#### 기존 테이블 수정
- `users` 테이블에 `is_super_admin` 컬럼 추가
- `workspaces` 테이블에 `subscription_tier`, `subscription_status` 컬럼 추가

---

## 2. AWS IAM 스타일 권한 시스템 구현 (`0ddafa2`)

### 백엔드 (Elysia Server)

#### 새로운 서비스
- `elysia-server/src/services/iam.service.ts` - IAM 핵심 로직
  - 정책 CRUD
  - 역할 CRUD
  - 멤버 역할/정책 관리
  - 권한 평가 로직
- `elysia-server/src/services/billing.service.ts` - 결제 서비스
  - 고객, 상품, 요금제, 구독 관리

#### 새로운 라우트
- `elysia-server/src/routes/iam.routes.ts` (766줄)
  - `GET/POST /policies` - 정책 관리
  - `GET/POST /roles` - 역할 관리
  - `POST /members/:memberId/roles` - 멤버 역할 할당
  - `POST /members/:memberId/policies` - 멤버 정책 할당
  - `GET /audit-logs` - 감사 로그 조회
  - `GET /tier-boundaries` - 등급별 Boundary 조회
- `elysia-server/src/routes/billing.routes.ts` (529줄)
  - 고객, 상품, 요금제, 구독 CRUD API

#### 새로운 플러그인
- `elysia-server/src/plugins/iam-auth.plugin.ts` - IAM 인증 미들웨어

#### 시드 데이터
- `elysia-server/src/db/seed-iam.ts` - 등급별 Boundary 정책 시드

### 프론트엔드 (Admin)

#### 새로운 페이지
| 경로 | 파일 | 설명 |
|------|------|------|
| `/iam/policies` | `PoliciesPage.tsx` | 정책 관리 |
| `/iam/policies/new` | `PolicyForm.tsx` | 정책 생성/수정 |
| `/iam/roles` | `RolesPage.tsx` | 역할 관리 |
| `/iam/roles/new` | `RoleForm.tsx` | 역할 생성/수정 |
| `/iam/audit-logs` | `AuditLogsPage.tsx` | 감사 로그 |
| `/iam/tier-boundaries` | `TierBoundariesPage.tsx` | 등급별 Boundary |
| `/billing/customers` | `CustomersPage.tsx` | 결제 고객 |
| `/billing/products` | `ProductsPage.tsx` | 상품 관리 |
| `/billing/plans` | `PlansPage.tsx` | 요금제 관리 |
| `/billing/subscriptions` | `SubscriptionsPage.tsx` | 구독 관리 |

#### 새로운 API Hooks
- `admin/src/lib/api/hooks/iam.ts` - IAM API React Query Hooks
- `admin/src/lib/api/hooks/billing.ts` - Billing API Hooks

#### 새로운 API 서비스
- `admin/src/lib/api/services/iam.ts` - IAM API 클라이언트
- `admin/src/lib/api/services/billing.ts` - Billing API 클라이언트

#### 새로운 타입 정의
- `admin/src/lib/api/types/iam.ts` - IAM 관련 타입
- `admin/src/lib/api/types/billing.ts` - Billing 관련 타입

#### UI 컴포넌트
- `admin/src/components/ui/data-filters.tsx` - 데이터 필터 컴포넌트
- `admin/src/components/ui/data-table.tsx` - 데이터 테이블 컴포넌트
- `admin/src/pages/workspaces/MemberIamSection.tsx` - 멤버 IAM 섹션

#### 문서
- `admin/docs/IAM_PERMISSION_SYSTEM.md` - IAM 시스템 문서

---

## 3. Onboarding DB 이전 및 Company Setting 통합 (`8a0786b`)

### 핵심 변경사항

#### Session Storage → DB 이전
- 온보딩 데이터를 브라우저 Session Storage에서 DB로 이전
- 새로운 `onboarding` 테이블 생성

### 백엔드

#### 새로운 스키마
- `elysia-server/src/db/schema/onboarding.ts` - 온보딩 테이블

#### 새로운 서비스
- `elysia-server/src/services/onboarding.service.ts` - 온보딩 서비스
  - 세션 저장/조회/업데이트
  - 단계별 데이터 관리

#### 새로운 라우트
- `elysia-server/src/routes/onboarding.routes.ts`
  - `GET /sessions/:sessionId` - 세션 조회
  - `POST /sessions` - 세션 생성
  - `PUT /sessions/:sessionId` - 세션 업데이트
  - `PUT /sessions/:sessionId/step/:step` - 단계별 업데이트

#### 새로운 플러그인
- `elysia-server/src/plugins/activity-logger.plugin.ts` - 활동 로그 플러그인
- `elysia-server/src/plugins/permission-guard.plugin.ts` - 권한 검사 플러그인

#### IAM 리소스 상수
- `elysia-server/src/constants/iam-resources.ts` - 리소스/액션 상수 정의

### 프론트엔드

#### Permission 시스템 (신규)
새로운 권한 관리 모듈: `admin/src/lib/permission/`

| 파일 | 설명 |
|------|------|
| `PermissionProvider.tsx` | 권한 Context Provider |
| `RouteGuard.tsx` | 라우트 보호 컴포넌트 |
| `components.tsx` | 권한 기반 UI 컴포넌트 |
| `constants.ts` | 권한 상수 |
| `hooks.ts` | 권한 관련 Hooks |
| `types.ts` | 권한 타입 정의 |
| `utils.ts` | 권한 유틸리티 |
| `index.ts` | 모듈 Export |

#### 새로운 페이지
| 경로 | 파일 | 설명 |
|------|------|------|
| `/activity-logs` | `ActivityLogsPage.tsx` | 활동 로그 페이지 |
| - | `ActivityLogsFilters.tsx` | 활동 로그 필터 |
| - | `ActivityLogsTableWithPagination.tsx` | 활동 로그 테이블 |

#### 새로운 API Hooks
- `admin/src/lib/api/hooks/onboarding.ts` - 온보딩 API Hooks

#### 새로운 API 서비스
- `admin/src/lib/api/services/onboarding.ts` - 온보딩 API 클라이언트

#### 수정된 컴포넌트
- `admin/src/components/AppSidebar.tsx` - 권한 기반 메뉴 필터링
- `admin/src/components/ProtectedRoute.tsx` - 권한 검사 로직 추가
- `admin/src/pages/settings.tsx` - Company Setting 통합
- `admin/src/router/index.tsx` - 새로운 라우트 추가

#### 온보딩 스텝 컴포넌트 수정
- `StepCompanyInfo.tsx` - DB 연동
- `StepConfirmation.tsx` - DB 연동
- `StepEmailGeneration.tsx` - DB 연동
- `StepLeadSearch.tsx` - DB 연동

#### Locale 추가
- `admin/locales/settings.csv` - 설정 페이지 다국어
- `admin/locales/sidebar.csv` - 사이드바 다국어

#### 삭제된 파일
- `admin/src/layouts/AppLayout.tsx` (-200줄)
- `admin/src/pages/workspaces/WorkspaceCompanyInfo.tsx` (-340줄)

---

## 권한 평가 순서

```
1. Super Admin → 전체 허용
2. 워크스페이스 멤버십 체크
3. Tier Boundary 체크 (등급별 최대 권한)
4. Explicit Deny → 거부
5. Explicit Allow → 허용
6. Default → 거부
```

---

## 등급별 기능 제한

| 등급 | 제한 사항 |
|------|----------|
| Trial | 리드 20개, 성과지표 X, 캠페인 실행 X, Linda GPT X |
| Basic | Linda GPT X, 캠페인 Admin 대행 |
| Pro | Linda GPT X, 셀프 서빙 가능 |
| Enterprise | 모든 기능 (Linda GPT 포함) |

---

## 마이그레이션

### DB 마이그레이션 파일
- `elysia-server/drizzle/0033_lively_warbound.sql` - Billing/IAM 테이블
- `elysia-server/drizzle/0034_gorgeous_karma.sql` - Onboarding 테이블

### 실행 방법
```bash
cd elysia-server
bun run db:migrate
bun run db:seed-iam  # IAM 시드 데이터
```

---

## 주요 파일 구조

```
elysia-server/
├── src/
│   ├── db/schema/
│   │   ├── billing.ts          # Billing 스키마
│   │   ├── iam.ts              # IAM 스키마
│   │   ├── onboarding.ts       # Onboarding 스키마
│   │   └── enums.ts            # Enum 정의
│   ├── services/
│   │   ├── iam.service.ts      # IAM 서비스
│   │   ├── billing.service.ts  # Billing 서비스
│   │   └── onboarding.service.ts
│   ├── routes/
│   │   ├── iam.routes.ts       # IAM API
│   │   ├── billing.routes.ts   # Billing API
│   │   └── onboarding.routes.ts
│   ├── plugins/
│   │   ├── iam-auth.plugin.ts
│   │   ├── activity-logger.plugin.ts
│   │   └── permission-guard.plugin.ts
│   └── constants/
│       └── iam-resources.ts

admin/
├── src/
│   ├── lib/
│   │   ├── permission/         # 권한 시스템 모듈
│   │   │   ├── PermissionProvider.tsx
│   │   │   ├── RouteGuard.tsx
│   │   │   ├── hooks.ts
│   │   │   └── ...
│   │   └── api/
│   │       ├── hooks/
│   │       │   ├── iam.ts
│   │       │   ├── billing.ts
│   │       │   └── onboarding.ts
│   │       ├── services/
│   │       │   ├── iam.ts
│   │       │   ├── billing.ts
│   │       │   └── onboarding.ts
│   │       └── types/
│   │           ├── iam.ts
│   │           └── billing.ts
│   └── pages/
│       ├── iam/                # IAM 관리 페이지
│       ├── billing/            # Billing 관리 페이지
│       └── activity-logs/      # 활동 로그 페이지

docs/
├── PERMISSION_SYSTEM_DESIGN.md
├── PERMISSION_LEVEL_ACCESS_POLICY.md
├── PERMISSION_WORKSPACE_VS_MEMBER.md
└── PERMISSION_SYSTEM_ERD.puml
```

---

*마지막 업데이트: 2025-12-12*
