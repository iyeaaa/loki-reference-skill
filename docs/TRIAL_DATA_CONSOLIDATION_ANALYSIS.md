# Trial 데이터 통합 분석

> 분석일: 2025-12-22
> 목적: Trial 관련 데이터 3중 복제 해결, `subscriptions` 테이블 단일 진실 소스화

---

## 목차

- [1. 현재 Trial 데이터 위치](#1-현재-trial-데이터-위치)
- [2. 하드코딩된 Trial 값](#2-하드코딩된-trial-값)
- [3. 영향받는 파일 목록](#3-영향받는-파일-목록)
- [4. 영향도 분석](#4-영향도-분석)
- [5. 통합 계획](#5-통합-계획)
- [6. 마이그레이션 가이드](#6-마이그레이션-가이드)

---

## 1. 현재 Trial 데이터 위치

### 1.1 DB 스키마 - Trial 관련 컬럼

#### 위치 1: `users` 테이블 (❌ deprecated 예정)

**파일:** `elysia-server/src/db/schema/users.ts:58-61`

```typescript
// Trial period fields
trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
isTrialActive: boolean("is_trial_active").default(false),
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `trial_start_date` | timestamp | Trial 시작일 |
| `trial_end_date` | timestamp | Trial 종료일 |
| `is_trial_active` | boolean | Trial 활성 여부 |

**인덱스:**
```typescript
trialActiveIdx: index("users_trial_active_idx").on(table.isTrialActive),
```

---

#### 위치 2: `subscriptions` 테이블 (✅ 진실 소스로 지정)

**파일:** `elysia-server/src/db/schema/billing.ts:228-235`

```typescript
status: subscriptionStatusEnum("status").notNull().default("trialing"),
trialStart: timestamp("trial_start", { withTimezone: true }),
trialEnd: timestamp("trial_end", { withTimezone: true }),
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `status` | enum | 구독 상태 (trialing/active/...) |
| `trial_start` | timestamp | Trial 시작일 |
| `trial_end` | timestamp | Trial 종료일 |

**Status Enum 값:**
```typescript
["trialing", "active", "canceled", "incomplete", "past_due", "unpaid", "paused"]
```

---

#### 위치 3: `billing_plans` 테이블

**파일:** `elysia-server/src/db/schema/billing.ts:168`

```typescript
trialDays: integer("trial_days").default(0),
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `trial_days` | integer | 요금제별 Trial 기간 (일) |

---

#### 위치 4: `workspaces` 테이블 (캐시/비정규화)

**파일:** `elysia-server/src/db/schema/workspaces.ts:67-70`

```typescript
subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("trial"),
subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("trialing"),
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `subscription_tier` | enum | 구독 등급 (trial/basic/pro/enterprise) |
| `subscription_status` | enum | 구독 상태 (비정규화 캐시) |

---

### 1.2 Enum 정의

**파일:** `elysia-server/src/db/schema/enums.ts`

```typescript
// 구독 등급 (Line 15-23)
export const subscriptionTierEnum = pgEnum("subscription_tier_enum", [
  "trial",      // 무료 체험 (기능 제한)
  "basic",
  "pro",
  "enterprise",
])

// 구독 상태 (Line 29-42)
export const subscriptionStatusEnum = pgEnum("subscription_status_enum", [
  "trialing",   // 체험 기간
  "active",
  "canceled",
  ...
])
```

---

## 2. 하드코딩된 Trial 값

### 2.1 Trial 기간 하드코딩 (7일)

| 파일 | 라인 | 코드 | 문제 |
|------|------|------|------|
| `user.service.ts` | 56-59 | `trialEndDate.setDate(trialEndDate.getDate() + 7)` | **7일 하드코딩** |
| `user.service.ts` | 883-886 | `trialEndDate.setDate(trialEndDate.getDate() + 7)` | **7일 하드코딩** (OAuth 사용자) |
| `workspace.service.ts` | 152 | `trialEnd.setDate(trialEnd.getDate() + (trialPlan.trialDays \|\| 7))` | 7일 fallback |

### 2.2 Trial 기간 참조 흐름

```
사용자 생성 (user.service.ts)
    │
    ├─ createUser(): 7일 하드코딩 → users.trialEndDate
    │
    └─ upsertOAuthUser(): 7일 하드코딩 → users.trialEndDate

워크스페이스 생성 (workspace.service.ts)
    │
    ├─ getDefaultTrialPlan(): DB에서 billing_plans.trial_days 조회
    │
    └─ createTrialSubscription():
         │
         ├─ trialPlan.trialDays 사용 (DB 값)
         │
         └─ fallback: 7일 (trialDays가 null인 경우)
```

### 2.3 TRIAL_PREVIEW 상수

**용도:** 온보딩 중 임시 이메일 계정 표시

| 파일 | 사용 위치 |
|------|----------|
| `campaign-generator.service.ts:623` | `apiKey: "TRIAL_PREVIEW"` |
| `onboarding.service.ts:1701` | `apiKey: "TRIAL_PREVIEW"` |
| `onboarding-worker.service.ts:1107` | `apiKey: "TRIAL_PREVIEW"` |
| `email.service.ts:262-265` | TRIAL_PREVIEW 스킵 로직 |
| `nylas.routes.ts:138-232` | TRIAL_PREVIEW → 실제 계정 마이그레이션 |
| `auth.routes.ts:770-774` | TRIAL_PREVIEW 삭제 |

---

## 3. 영향받는 파일 목록

### 3.1 Backend 파일

| 파일 | Trial 관련 기능 | 수정 필요 |
|------|----------------|----------|
| **DB Schema** | | |
| `db/schema/users.ts` | trial 컬럼 정의 | ⚠️ deprecated 마킹 |
| `db/schema/billing.ts` | subscriptions.trial* 정의 | ✅ 진실 소스 |
| `db/schema/workspaces.ts` | tier/status 캐시 | 동기화 로직 필요 |
| `db/schema/enums.ts` | trial/trialing enum | 유지 |
| **Services** | | |
| `services/user.service.ts` | 사용자 생성 시 trial 설정 | 🔴 수정 필요 |
| `services/workspace.service.ts` | subscription 생성 | ✅ 이미 DB 참조 |
| `services/iam.service.ts` | tier 기반 권한 체크 | 검토 필요 |
| `services/onboarding.service.ts` | TRIAL_PREVIEW 사용 | 유지 |
| `services/email.service.ts` | TRIAL_PREVIEW 스킵 | 유지 |
| **Routes** | | |
| `routes/auth.routes.ts` | TRIAL_PREVIEW 처리 | 유지 |
| `routes/billing.routes.ts` | trialDays API | 유지 |
| `routes/nylas.routes.ts` | TRIAL_PREVIEW 마이그레이션 | 유지 |

### 3.2 Frontend 파일 (29개)

| 파일 | 용도 |
|------|------|
| `pages/NewTrialPage.tsx` | Trial 가입 페이지 |
| `pages/TrialResultPage.tsx` | Trial 결과 페이지 |
| `pages/LoginPage.tsx` | Trial 로그인 |
| `pages/onboarding/index.tsx` | 온보딩 설문 |
| `pages/billing/SubscriptionsPage.tsx` | 구독 관리 |
| `pages/billing/PlansPage.tsx` | 요금제 관리 |
| `pages/billing/PlanForm.tsx` | 요금제 폼 (trialDays) |
| `pages/iam/TierBoundariesPage.tsx` | Tier 경계 관리 |
| `components/trial/DashboardPreview.tsx` | Trial 대시보드 |
| `lib/auth-provider.tsx` | 인증 컨텍스트 |
| `lib/api/types/auth.ts` | 인증 타입 |
| `lib/api/types/billing.ts` | 빌링 타입 |
| `lib/api/hooks/auth.ts` | 인증 훅 |
| `router/index.tsx` | Trial 라우팅 |
| ... | (기타 15개 파일) |

---

## 4. 영향도 분석

### 4.1 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                      현재 데이터 흐름 (문제)                      │
└─────────────────────────────────────────────────────────────────┘

사용자 가입
    │
    ├─► user.service.ts
    │       │
    │       ├─► users.trialStartDate = now
    │       ├─► users.trialEndDate = now + 7일 (하드코딩!)
    │       └─► users.isTrialActive = true
    │
    ├─► workspace.service.ts
    │       │
    │       ├─► getDefaultTrialPlan() → billing_plans.trial_days 조회
    │       │
    │       └─► subscriptions 생성
    │               ├─► status = "trialing"
    │               ├─► trial_start = now
    │               └─► trial_end = now + trialDays (DB 값 또는 7일)
    │
    └─► 결과: users.trialEndDate ≠ subscriptions.trial_end 가능!


┌─────────────────────────────────────────────────────────────────┐
│                      수정 후 데이터 흐름 (목표)                    │
└─────────────────────────────────────────────────────────────────┘

사용자 가입
    │
    └─► workspace.service.ts
            │
            ├─► getDefaultTrialPlan() → billing_plans.trial_days 조회
            │
            └─► subscriptions 생성 (단일 진실 소스)
                    ├─► status = "trialing"
                    ├─► trial_start = now
                    └─► trial_end = now + trialDays
                            │
                            └─► workspaces.subscriptionStatus 동기화
                                workspaces.subscriptionValidUntil 동기화
```

### 4.2 불일치 발생 시나리오

| 시나리오 | 결과 | 위험도 |
|----------|------|--------|
| users.trialEndDate = 2025-01-01 (7일 후) | 사용자는 trial 만료로 인식 | 🟡 중간 |
| subscriptions.trial_end = 2025-01-15 (DB 설정 30일) | 실제 구독은 유효 | |
| → 일부 코드는 users 참조, 일부는 subscriptions 참조 | 기능 제한 불일치 | 🔴 높음 |

### 4.3 현재 Trial 기간 설정값

| 위치 | 값 | 용도 |
|------|-----|------|
| `user.service.ts` (하드코딩) | **7일** | users 테이블 |
| `billing_plans.trial_days` (DB) | **설정값** | subscriptions 테이블 |
| `workspace.service.ts` (fallback) | **7일** | DB값 없을 때 |

---

## 5. 통합 계획

### 5.1 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     단일 진실 소스: subscriptions                 │
└─────────────────────────────────────────────────────────────────┘

                    billing_plans
                         │
                         │ trial_days (요금제별 설정)
                         ▼
                   subscriptions ◄────── 단일 진실 소스
                    ├─ status
                    ├─ trial_start
                    └─ trial_end
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
     workspaces      users          프론트엔드
   (캐시 동기화)   (deprecated)     (API 조회)
```

### 5.2 변경 사항

#### Phase 1: 백엔드 수정

| 파일 | 변경 내용 | 우선순위 |
|------|----------|----------|
| `user.service.ts` | Trial 관련 코드 제거 | 🔴 높음 |
| `createUser()` | trialStartDate/trialEndDate 설정 제거 | |
| `upsertOAuthUser()` | trialStartDate/trialEndDate 설정 제거 | |
| `workspace.service.ts` | 이미 올바르게 구현됨 (유지) | ✅ 완료 |
| `db/schema/users.ts` | Trial 컬럼 deprecated 주석 추가 | 🟡 중간 |

#### Phase 2: Trial 상태 조회 통합

```typescript
// 기존 (사용 금지)
const user = await getUser(userId)
const isTrialActive = user.isTrialActive

// 신규 (권장)
const trialStatus = await getTrialStatusFromSubscription(workspaceId)
const isTrialActive = trialStatus.status === "trialing" && trialStatus.trialEnd > new Date()
```

#### Phase 3: 데이터 마이그레이션

```sql
-- users 테이블의 trial 데이터를 subscriptions 기준으로 동기화
UPDATE users u
SET
  trial_start_date = s.trial_start,
  trial_end_date = s.trial_end,
  is_trial_active = (s.status = 'trialing' AND s.trial_end > NOW())
FROM workspace_members wm
JOIN subscriptions s ON wm.workspace_id = s.workspace_id AND s.is_primary = true
WHERE u.id = wm.user_id;
```

### 5.3 삭제 대상 코드

```typescript
// ❌ 삭제: user.service.ts createUser() (Line 56-59)
// Calculate trial period (7 days from now)
const trialStartDate = new Date()
const trialEndDate = new Date()
trialEndDate.setDate(trialEndDate.getDate() + 7)

// ❌ 삭제: user.service.ts upsertOAuthUser() (Line 883-886)
// Calculate trial period (7 days from now)
const trialStartDate = new Date()
const trialEndDate = new Date()
trialEndDate.setDate(trialEndDate.getDate() + 7)
```

---

## 6. 마이그레이션 가이드

### 6.1 단계별 마이그레이션

#### Step 1: Trial 상태 조회 함수 추가

```typescript
// elysia-server/src/services/subscription.service.ts

export async function getTrialStatus(workspaceId: string) {
  const [subscription] = await db
    .select({
      status: subscriptions.status,
      trialStart: subscriptions.trialStart,
      trialEnd: subscriptions.trialEnd,
      planTrialDays: billingPlans.trialDays,
    })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
    .where(and(
      eq(subscriptions.workspaceId, workspaceId),
      eq(subscriptions.isPrimary, true)
    ))
    .limit(1)

  if (!subscription) {
    return { isTrialActive: false, daysRemaining: 0, trialEnd: null }
  }

  const now = new Date()
  const isTrialActive = subscription.status === "trialing" &&
                        subscription.trialEnd !== null &&
                        subscription.trialEnd > now

  const daysRemaining = subscription.trialEnd
    ? Math.max(0, Math.ceil((subscription.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  return {
    isTrialActive,
    daysRemaining,
    trialEnd: subscription.trialEnd,
    status: subscription.status,
  }
}
```

#### Step 2: user.service.ts 수정

```typescript
// elysia-server/src/services/user.service.ts

export async function createUser(data: {...}) {
  // ❌ 삭제
  // const trialStartDate = new Date()
  // const trialEndDate = new Date()
  // trialEndDate.setDate(trialEndDate.getDate() + 7)

  const [newUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash || null,
      userRole: data.userRole || "user",
      isActive: data.isActive !== undefined ? data.isActive : true,
      departmentId: data.departmentId || null,
      employeeId: data.employeeId || null,
      // ❌ 삭제
      // trialStartDate,
      // trialEndDate,
      // isTrialActive: true,
    })
    .returning({...})

  return newUser
}
```

#### Step 3: Deprecated 마킹

```typescript
// elysia-server/src/db/schema/users.ts

export const users = pgTable(
  "users",
  {
    // ... 기존 필드들 ...

    // ⚠️ DEPRECATED: Use subscriptions table instead
    // Trial 데이터는 subscriptions.trial_start/trial_end 사용
    // TODO: 2025-03-01 이후 제거 예정
    /** @deprecated Use subscriptions.trial_start instead */
    trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
    /** @deprecated Use subscriptions.trial_end instead */
    trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
    /** @deprecated Use subscriptions.status === 'trialing' instead */
    isTrialActive: boolean("is_trial_active").default(false),
  }
)
```

#### Step 4: 기존 코드 참조 수정

```typescript
// Before (deprecated)
const user = await getUser(userId)
if (user.isTrialActive && user.trialEndDate > new Date()) {
  // trial 유효
}

// After (권장)
const workspace = await getWorkspaceByUserId(userId)
const trialStatus = await getTrialStatus(workspace.id)
if (trialStatus.isTrialActive) {
  // trial 유효
}
```

### 6.2 프론트엔드 수정

Trial 상태는 이제 `/api/v1/subscriptions/status` 또는 workspace 정보에서 조회:

```typescript
// admin/src/lib/api/hooks/subscription.ts

export function useTrialStatus(workspaceId: string) {
  return useQuery({
    queryKey: ['trial-status', workspaceId],
    queryFn: async () => {
      const res = await apiFetch(`/subscriptions/workspace/${workspaceId}/status`)
      return res.json()
    },
  })
}
```

### 6.3 마이그레이션 체크리스트

- [ ] `getTrialStatus()` 함수 추가
- [ ] `user.service.ts` createUser() Trial 코드 제거
- [ ] `user.service.ts` upsertOAuthUser() Trial 코드 제거
- [ ] `users` 스키마 Trial 컬럼 deprecated 마킹
- [ ] 기존 users.isTrialActive 참조 → getTrialStatus() 변경
- [ ] 프론트엔드 Trial 상태 조회 API 변경
- [ ] 데이터 마이그레이션 SQL 실행
- [ ] 테스트: 신규 가입 Trial 생성
- [ ] 테스트: Trial 만료 체크
- [ ] 테스트: Trial → Paid 전환

---

## 7. 요약

### 현재 문제

| 위치 | 값 | 문제 |
|------|-----|------|
| `users.trialEndDate` | 7일 하드코딩 | 동기화 안 됨 |
| `subscriptions.trial_end` | DB 설정값 | 진실 소스 |
| `billing_plans.trial_days` | 요금제별 설정 | 정상 |

### 해결 방향

1. **진실 소스 지정**: `subscriptions` 테이블
2. **하드코딩 제거**: `user.service.ts`의 7일 → DB 값 사용
3. **deprecated 처리**: `users` 테이블의 trial 컬럼
4. **함수 통합**: `getTrialStatus(workspaceId)` 단일 함수

### 예상 작업량

| 작업 | 예상 시간 |
|------|----------|
| 백엔드 코드 수정 | 2-3시간 |
| 프론트엔드 수정 | 1-2시간 |
| 데이터 마이그레이션 | 30분 |
| 테스트 | 1-2시간 |
| **합계** | **5-8시간** |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-22 | 초기 분석 문서 작성 |
