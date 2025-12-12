# feat/permission 브랜치 핵심 요약

> 브랜치: `feat/permission`
> 기준: main 브랜치 대비 변경사항

---

## 핵심 변경사항 3가지

### 1. AWS IAM 스타일 권한 시스템

```
정책(Policy) → 역할(Role) → 멤버(Member) 구조
```

- **Tier Boundary**: Trial/Basic/Pro/Enterprise 등급별 최대 권한 제한
- **권한 평가 순서**: Super Admin → 멤버십 → Tier Boundary → Deny → Allow → Default Deny

### 2. Onboarding DB 이전

```
Session Storage → PostgreSQL DB
```

- 온보딩 데이터 영구 저장
- Company Setting 페이지 통합

### 3. 프론트엔드 권한 모듈

`admin/src/lib/permission/` 디렉토리에 권한 관리 모듈 추가:

- `PermissionProvider` - 권한 Context
- `RouteGuard` - 라우트 보호
- `usePermission` hooks

---

## 새로운 DB 테이블

| 도메인 | 테이블 |
|--------|--------|
| **IAM** | `iam_policies`, `iam_policy_statements`, `iam_workspace_roles`, `iam_role_policies`, `iam_member_roles`, `iam_member_policies`, `iam_tier_boundaries`, `iam_audit_logs` |
| **Billing** | `billing_customers`, `billing_products`, `billing_plans`, `subscriptions` |
| **Onboarding** | `onboarding` |

---

## 새로운 API 엔드포인트

| 경로 | 용도 |
|------|------|
| `/iam/*` | 정책/역할/멤버 권한 관리 |
| `/billing/*` | 고객/상품/요금제/구독 |
| `/onboarding/sessions/*` | 온보딩 세션 CRUD |

---

## 새로운 Admin 페이지

- `/iam/policies`, `/iam/roles`, `/iam/audit-logs`, `/iam/tier-boundaries`
- `/billing/customers`, `/billing/products`, `/billing/plans`, `/billing/subscriptions`
- `/activity-logs`

---

## 등급별 기능 제한

| 등급 | 제한 사항 |
|------|----------|
| Trial | 리드 20개, 성과지표 X, 캠페인 실행 X, Rinda GPT X |
| Basic | Rinda GPT X, 캠페인 Admin 대행 |
| Pro | Rinda GPT X, 셀프 서빙 가능 |
| Enterprise | 모든 기능 (Rinda GPT 포함) |

---

## 주요 파일 구조

```
elysia-server/src/
├── db/schema/
│   ├── billing.ts
│   ├── iam.ts
│   └── onboarding.ts
├── services/
│   ├── iam.service.ts
│   ├── billing.service.ts
│   └── onboarding.service.ts
├── routes/
│   ├── iam.routes.ts
│   ├── billing.routes.ts
│   └── onboarding.routes.ts
└── plugins/
    ├── iam-auth.plugin.ts
    ├── activity-logger.plugin.ts
    └── permission-guard.plugin.ts

admin/src/lib/
├── permission/
│   ├── PermissionProvider.tsx
│   ├── RouteGuard.tsx
│   ├── hooks.ts
│   └── ...
└── api/
    ├── hooks/iam.ts, billing.ts, onboarding.ts
    ├── services/iam.ts, billing.ts, onboarding.ts
    └── types/iam.ts, billing.ts
```

---

## 마이그레이션

```bash
cd elysia-server
bun run db:migrate
bun run db:seed-iam
```

---

*마지막 업데이트: 2025-12-12*
