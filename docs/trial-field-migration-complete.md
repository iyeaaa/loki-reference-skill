# Users 테이블 Trial 필드 → Subscriptions 테이블 마이그레이션

> **작성일**: 2024-12-22
> **목적**: 유저 테이블의 체험판(trial) 필드를 제거하고 구독 시스템(subscriptions)으로 통합

---

## 1. 배경 및 문제 분석

### 1.1 기존 구조의 문제점

기존에는 trial 정보가 **3곳에 중복** 존재했습니다:

| 테이블 | 필드 | 단위 | 용도 |
|--------|------|------|------|
| **users** | `trial_start_date`, `trial_end_date`, `is_trial_active` | 유저 개인 | 체험판 상태 |
| **workspaces** | `subscription_tier`, `subscription_status`, `subscription_valid_until` | 워크스페이스 | 구독 캐시 |
| **subscriptions** | `status`, `trial_start`, `trial_end` | 워크스페이스 | 정규화된 구독 |

### 1.2 문제점

1. **데이터 중복**: 동일한 정보가 여러 테이블에 존재
2. **데이터 불일치 가능성**: 동기화 로직 필요
3. **SaaS B2B 패턴 위반**: 유저 개인 단위 trial vs 워크스페이스 단위 구독 충돌
4. **확장성 제한**: 팀 구독, 멀티시트 과금 등 확장 어려움

### 1.3 해결 방안

```
Before (중복):
┌─────────────────────────────────┐
│           users                 │
│  ├── trial_start_date          │  ← 제거
│  ├── trial_end_date            │  ← 제거
│  └── is_trial_active           │  ← 제거
└─────────────────────────────────┘

After (Single Source of Truth):
┌─────────────────────────────────┐
│         subscriptions           │
│  ├── status = 'trialing'       │  ← trial 상태
│  ├── trial_start               │  ← 시작일
│  └── trial_end                 │  ← 종료일
└─────────────────────────────────┘
```

---

## 2. 프론트엔드 Trial 필드 사용 현황 분석

### 2.1 타입 정의

**파일**: `admin/src/lib/api/types/auth.ts:30-34`

```typescript
trialStatus?: {
  isTrialActive: boolean
  daysRemaining: number
  trialEndDate: string
}
```

### 2.2 사용 페이지/컴포넌트

| 파일 | 용도 | 코드 위치 |
|------|------|----------|
| `NewTrialPage.tsx` | Google 로그인 시 trialStatus 수신 및 환영 메시지 | :31-35, 74-76 |
| `DashboardLayout.tsx` | Trial 유저 "전체" 워크스페이스 옵션 숨김 | :64, 84-97, 117-132 |
| `auth-provider.tsx` | User 타입에 trialStatus 정의 | :11-15 |
| `hooks/auth.ts` | 로그아웃 시 trial 유저 리다이렉트 분기 | :88, 101 |
| `ProtectedRoute.tsx` | 미인증 시 /trial로 리다이렉트 | :64 |

---

## 3. 운영 DB 분석 결과

### 3.1 데이터 현황

```
┌─────────────────────────────────────────────┐
│              데이터베이스 현황               │
├─────────────────────────────────────────────┤
│ 총 유저:            58명                    │
│ 삭제된 유저:        14명 (@deleted.local)   │
│ 활성 유저:          44명                    │
│                                             │
│ 총 워크스페이스:    58개                    │
│ 총 구독:            22개                    │
│ → 구독 누락:        36개 ⚠️                 │
│                                             │
│ trialing 상태:      22개                    │
│ 만료된 trial:       3개                     │
└─────────────────────────────────────────────┘
```

### 3.2 데이터 불일치 발견

```sql
-- 분석 쿼리 결과
total | trial_user_no_workspace | trial_user_no_subscription | both_trial | mismatch
------+-------------------------+----------------------------+------------+----------
   78 |                       7 |                         10 |         21 |        0
```

| 문제 | 수량 | 상세 |
|------|------|------|
| Trial 유저인데 워크스페이스 없음 | 7명 | 6명 삭제된 유저, 1명 실제 유저 |
| 워크스페이스 있지만 구독 없음 | 36개 | 활성 유저 소유 |
| Trial 유저 + 워크스페이스 O + 구독 X | 3명 | 실제 영향받는 유저 |

### 3.3 구독 생성 필요 유저 (3명)

| 이메일 | 워크스페이스 |
|--------|-------------|
| soodata20@gmail.com | 수다쟁이의 워크스페이스 |
| csh13080@gmail.com | 조서현의 워크스페이스 |
| zalatanback2@gmail.com | محمد مجدى의 워크스페이스 |

---

## 4. 변경된 파일 목록

### 4.1 백엔드 (elysia-server)

#### `src/db/schema/users.ts`
**변경**: trial 필드 3개 및 인덱스 제거

```diff
- // Trial period fields
- trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
- trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
- isTrialActive: boolean("is_trial_active").default(false),

  (table) => ({
    departmentIdx: index("users_department_id_idx").on(table.departmentId),
    authProviderIdx: index("users_auth_provider_idx").on(table.authProvider),
    oauthIdIdx: index("users_oauth_id_idx").on(table.oauthId),
-   trialActiveIdx: index("users_trial_active_idx").on(table.isTrialActive),
    onboardingStepIdx: index("users_onboarding_step_idx").on(table.onboardingStep),
  }),
```

#### `src/services/user.service.ts`
**변경**: trial 관련 로직을 workspace 구독 기반으로 변경

1. **createUser**: trial 필드 제거
```diff
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
-     trialStartDate,
-     trialEndDate,
-     isTrialActive: true,
    })
```

2. **createOrUpdateGoogleUser**: trial 필드 제거
```diff
  const [upsertedUser] = await db
    .insert(users)
    .values({
      ...
-     trialStartDate,
-     trialEndDate,
-     isTrialActive: true,
      lastLoginAt: new Date(),
    })
    .returning({
      ...
-     trialStartDate: users.trialStartDate,
-     trialEndDate: users.trialEndDate,
-     isTrialActive: users.isTrialActive,
    })

- // Create default workspace for new trial users
- if (!existingUser && upsertedUser?.isTrialActive) {
+ // Create default workspace for new users (workspace 생성 시 trial 구독 자동 생성됨)
+ if (!existingUser && upsertedUser) {
```

3. **checkTrialStatus**: workspace 구독 기반으로 완전 재작성
```typescript
// 사용자의 첫 번째 워크스페이스의 구독 상태를 기반으로 trial 상태 확인
export async function checkTrialStatus(userId: string) {
  const userWorkspaces = await workspaceService.getWorkspacesByOwner(userId)

  const workspace = userWorkspaces?.[0]
  if (!workspace) {
    return null
  }

  const [subscription] = await db
    .select({
      id: sql<string>`subscriptions.id`,
      status: sql<string>`subscriptions.status`,
      trialStart: sql<Date | null>`subscriptions.trial_start`,
      trialEnd: sql<Date | null>`subscriptions.trial_end`,
      currentPeriodEnd: sql<Date | null>`subscriptions.current_period_end`,
    })
    .from(sql`subscriptions`)
    .where(sql`subscriptions.workspace_id = ${workspace.id} AND subscriptions.is_primary = true`)
    .limit(1)

  if (!subscription) {
    return null
  }

  const now = new Date()
  const isTrialActive = subscription.status === "trialing"
  const trialEndDate = subscription.trialEnd || subscription.currentPeriodEnd
  const isTrialExpired = trialEndDate && now > trialEndDate

  return {
    isTrialActive,
    isTrialExpired,
    trialEndDate,
    daysRemaining: trialEndDate
      ? Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null,
  }
}
```

4. **updateTrialStatus, extendTrial**: 삭제됨 (불필요)

5. **getUserByOAuthId**: trial 필드 제거

#### `src/routes/auth.routes.ts`
**변경**: AuthUser 타입에서 trial 필드 제거

```diff
  type AuthUser = {
    id: string
    username: string
    email: string
    ...
-   trialStartDate?: Date | null
-   trialEndDate?: Date | null
-   isTrialActive?: boolean | null
    departmentName?: string | null
    departmentCode?: string | null
  }
```

#### `src/db/migrations/remove-user-trial-fields.sql` (신규)
```sql
-- Migration: Remove trial fields from users table
DROP INDEX IF EXISTS users_trial_active_idx;
ALTER TABLE users DROP COLUMN IF EXISTS trial_start_date;
ALTER TABLE users DROP COLUMN IF EXISTS trial_end_date;
ALTER TABLE users DROP COLUMN IF EXISTS is_trial_active;
```

---

### 4.2 프론트엔드 (admin)

#### `src/lib/api/types/auth.ts`
**변경**: trialStatus 필드 nullable 수정

```diff
  export type AuthUser = {
    ...
+   // Trial 상태는 workspace 구독(subscriptions 테이블) 기반으로 결정됨
    trialStatus?: {
      isTrialActive: boolean
-     daysRemaining: number
-     trialEndDate: string
+     daysRemaining: number | null
+     trialEndDate: string | null
    }
  }
```

#### `src/lib/auth-provider.tsx`
**변경**: User 타입 수정

```diff
  type User = {
    ...
+   // Trial 상태는 workspace 구독(subscriptions 테이블) 기반으로 결정됨
    trialStatus?: {
      isTrialActive: boolean
-     daysRemaining: number
-     trialEndDate: string
+     daysRemaining: number | null
+     trialEndDate: string | null
    }
  }
```

#### `src/pages/NewTrialPage.tsx`
**변경**: null 체크 추가

```diff
- if (response.user.trialStatus?.isTrialActive) {
+ if (response.user.trialStatus?.isTrialActive && response.user.trialStatus.daysRemaining != null) {
    toast.info(`무료 체험 기간: ${response.user.trialStatus.daysRemaining}일 남음`)
  }
```

---

## 5. 마이그레이션 전략

### 5.1 사전 작업 (필수 - 배포 전 실행)

#### Step 1: 누락된 billing_customers 생성

```sql
INSERT INTO billing_customers (user_id, external_customer_id, email, name)
SELECT
  u.id,
  'internal_' || u.id,
  u.email,
  u.username
FROM users u
LEFT JOIN billing_customers bc ON bc.user_id = u.id
WHERE bc.id IS NULL
AND u.email NOT LIKE '%@deleted.local%';
```

#### Step 2: 누락된 subscriptions 생성 (36개)

```sql
-- trial 요금제 ID 확인
SELECT id FROM billing_plans
WHERE product_id IN (SELECT id FROM billing_products WHERE tier = 'trial')
AND is_active = true AND is_default = true
LIMIT 1;

-- 구독 생성
INSERT INTO subscriptions (
  workspace_id, customer_id, plan_id, status, is_primary, quantity,
  trial_start, trial_end, current_period_start, current_period_end
)
SELECT
  w.id,
  bc.id,
  (SELECT id FROM billing_plans
   WHERE product_id IN (SELECT id FROM billing_products WHERE tier = 'trial')
   AND is_active = true AND is_default = true LIMIT 1),
  'trialing',
  true,
  1,
  COALESCE(u.trial_start_date, NOW()),
  COALESCE(u.trial_end_date, NOW() + INTERVAL '30 days'),
  COALESCE(u.trial_start_date, NOW()),
  COALESCE(u.trial_end_date, NOW() + INTERVAL '30 days')
FROM workspaces w
JOIN users u ON u.id = w.owner_id
JOIN billing_customers bc ON bc.user_id = u.id
LEFT JOIN subscriptions s ON s.workspace_id = w.id
WHERE s.id IS NULL
AND u.email NOT LIKE '%@deleted.local%';
```

#### Step 3: 데이터 검증

```sql
-- 모든 활성 워크스페이스에 구독이 있는지 확인 (결과가 0이어야 함)
SELECT COUNT(*) as missing_subscriptions
FROM workspaces w
JOIN users u ON u.id = w.owner_id
LEFT JOIN subscriptions s ON s.workspace_id = w.id
WHERE s.id IS NULL
AND u.email NOT LIKE '%@deleted.local%';
```

### 5.2 배포 순서

```
1. DB 사전 작업 (Step 1-3)
   ├── billing_customers 생성
   ├── subscriptions 생성 (36개)
   └── 검증 완료 확인

2. 백엔드 배포 (elysia-server)
   └── 새 로그인부터 workspace 구독 기반 trial 상태 사용

3. 프론트엔드 배포 (admin)
   └── 타입 변경사항 적용

4. DB 스키마 마이그레이션
   └── users 테이블에서 trial 필드 제거
```

### 5.3 스키마 마이그레이션 실행

```sql
-- 배포 완료 후 실행
DROP INDEX IF EXISTS users_trial_active_idx;
ALTER TABLE users DROP COLUMN IF EXISTS trial_start_date;
ALTER TABLE users DROP COLUMN IF EXISTS trial_end_date;
ALTER TABLE users DROP COLUMN IF EXISTS is_trial_active;
```

---

## 6. 롤백 계획

### 6.1 스키마 롤백

```sql
-- 필드 복구
ALTER TABLE users ADD COLUMN trial_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN trial_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN is_trial_active BOOLEAN DEFAULT false;

-- 인덱스 복구
CREATE INDEX users_trial_active_idx ON users(is_trial_active);

-- 데이터 복구 (subscriptions에서)
UPDATE users u
SET
  trial_start_date = s.trial_start,
  trial_end_date = s.trial_end,
  is_trial_active = (s.status = 'trialing')
FROM workspaces w
JOIN subscriptions s ON s.workspace_id = w.id AND s.is_primary = true
WHERE w.owner_id = u.id;
```

---

## 7. 위험 요소 및 대응

| 위험 | 영향도 | 대응 방안 |
|------|--------|----------|
| 구독 없는 워크스페이스 | **높음** | 사전에 누락된 구독 생성 (36개) |
| 로그인 실패 | 높음 | checkTrialStatus가 null 반환해도 정상 동작하도록 구현됨 |
| 기존 trial 정보 손실 | 중간 | 마이그레이션 전 users.trial_end_date를 subscriptions.trial_end로 복사 |
| 프론트엔드 타입 오류 | 낮음 | nullable 타입으로 수정 완료 |

---

## 8. 배포 체크리스트

### 사전 작업
- [ ] 데이터베이스 백업 완료
- [ ] billing_customers 누락분 생성 완료
- [ ] subscriptions 누락분 생성 완료 (36개)
- [ ] 데이터 검증 쿼리 결과 0 확인

### 배포
- [ ] 백엔드 배포 완료
- [ ] 프론트엔드 배포 완료
- [ ] 로그인 테스트 통과
- [ ] Trial 상태 표시 정상 확인

### 마이그레이션
- [ ] DB 스키마 마이그레이션 완료
- [ ] 인덱스 제거 확인
- [ ] 컬럼 제거 확인

---

## 9. 변경 파일 요약

| 구분 | 파일 경로 | 변경 유형 |
|------|----------|----------|
| 백엔드 | `elysia-server/src/db/schema/users.ts` | 수정 |
| 백엔드 | `elysia-server/src/services/user.service.ts` | 수정 |
| 백엔드 | `elysia-server/src/routes/auth.routes.ts` | 수정 |
| 백엔드 | `elysia-server/src/db/migrations/remove-user-trial-fields.sql` | **신규** |
| 프론트엔드 | `admin/src/lib/api/types/auth.ts` | 수정 |
| 프론트엔드 | `admin/src/lib/auth-provider.tsx` | 수정 |
| 프론트엔드 | `admin/src/pages/NewTrialPage.tsx` | 수정 |
| 문서 | `admin/docs/trial-migration-plan.md` | **신규** |
| 문서 | `admin/docs/trial-field-migration-complete.md` | **신규** |

---

*작성일: 2024-12-22*
*작성자: Claude Code*
