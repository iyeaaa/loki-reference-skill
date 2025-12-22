# 온보딩 시스템 핵심 원인 분석 및 해결법

> 분석일: 2025-12-22
> 문서 목적: 각 이슈의 근본 원인과 구체적 해결 코드 제시

---

## 목차

- [Critical Issues](#critical-issues)
  - [C-01: JWT 인증 보안 취약점](#c-01-jwt-인증-보안-취약점)
  - [C-02: 외래키 제약조건 누락](#c-02-외래키-제약조건-누락)
  - [C-03: Trial 데이터 3중 복제](#c-03-trial-데이터-3중-복제)
  - [C-04: 트랜잭션 없는 다중 테이블 업데이트](#c-04-트랜잭션-없는-다중-테이블-업데이트)
- [High Priority Issues](#high-priority-issues)
  - [H-01: 온보딩 상태/스텝 불일치](#h-01-온보딩-상태스텝-불일치)
  - [H-02: SSE 연결 재시도 로직 부재](#h-02-sse-연결-재시도-로직-부재)
  - [H-03: 설문 데이터 이중 저장](#h-03-설문-데이터-이중-저장)
  - [H-04: 타임존 하드코딩](#h-04-타임존-하드코딩)
  - [H-05: Email Account Race Condition](#h-05-email-account-race-condition)
  - [H-06: Audit Trail 부재](#h-06-audit-trail-부재)
- [Medium Priority Issues](#medium-priority-issues)

---

## Critical Issues

---

### C-01: JWT 인증 보안 취약점

#### 현재 코드

**파일:** `elysia-server/src/services/auth.service.ts:24-36`

```typescript
// ❌ 현재: Base64 인코딩만 사용 (서명 없음)
export function generateToken(payload: TokenPayload): string {
  try {
    const tokenData = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
    }
    return Buffer.from(JSON.stringify(tokenData)).toString("base64")
  } catch (error) {
    console.error("Token generation error:", error)
    throw error
  }
}
```

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **암호화 서명 없음** | JWT 표준은 HMAC-SHA256 또는 RSA 서명을 요구하나, 단순 Base64 인코딩만 사용 |
| **검증 로직 부재** | `verifyToken()`이 디코딩만 하고 서명 검증을 하지 않음 |
| **개발용 코드 프로덕션 사용** | 주석에 "Simple token generation for development" 명시 |
| **만료 시간 미검증** | `iat`는 저장하나 `exp` 없고, 검증 시 만료 체크 안 함 |

#### 위험도 분석

```
공격 시나리오:
1. 공격자가 토큰 획득: eyJhbGciOiJub25lIi...
2. Base64 디코딩: {"userId":"abc","email":"user@test.com","iat":1234567890}
3. userId를 admin ID로 변경
4. 다시 Base64 인코딩하여 위조 토큰 생성
5. 서명 검증이 없으므로 위조 토큰 통과
```

#### 해결법

**1. jsonwebtoken 패키지 설치**

```bash
bun add jsonwebtoken
bun add -D @types/jsonwebtoken
```

**2. 환경 변수 설정**

```bash
# .env
JWT_SECRET=your-256-bit-secret-key-at-least-32-chars
JWT_EXPIRES_IN=7d
```

**3. 수정된 코드**

```typescript
// elysia-server/src/services/auth.service.ts

import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters")
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"

export interface TokenPayload {
  userId: string
  email: string
  userRole: "user" | "admin"
}

// ✅ 수정: HMAC-SHA256 서명 사용
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  })
}

// ✅ 수정: 서명 검증 + 만료 체크
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as TokenPayload & { iat: number; exp: number }

    return {
      userId: decoded.userId,
      email: decoded.email,
      userRole: decoded.userRole,
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("토큰이 만료되었습니다.")
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("유효하지 않은 토큰입니다.")
    }
    throw new Error(`토큰 검증 실패: ${error}`)
  }
}
```

**4. 기존 토큰 마이그레이션 전략**

```typescript
// 기존 Base64 토큰과 새 JWT 토큰 모두 지원 (과도기)
export async function verifyTokenWithFallback(token: string): Promise<TokenPayload> {
  // 새 JWT 형식 시도
  if (token.includes(".")) {
    return verifyToken(token)
  }

  // 기존 Base64 형식 (deprecated - 2주 후 제거)
  console.warn("[DEPRECATED] Base64 token used, please re-login")
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"))
    return {
      userId: decoded.userId,
      email: decoded.email,
      userRole: decoded.userRole,
    }
  } catch {
    throw new Error("유효하지 않은 토큰입니다.")
  }
}
```

---

### C-02: 외래키 제약조건 누락

#### 현재 코드

**파일:** `elysia-server/src/db/schema/onboarding.ts:57-63`

```typescript
// ❌ 현재: FK 제약조건 없음
selectedLeadIds: jsonb("selected_lead_ids").$type<string[]>(),
customerGroupId: uuid("customer_group_id"),  // FK 없음!
generatedSequenceId: uuid("generated_sequence_id"),  // FK 없음!
```

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **초기 설계 누락** | 빠른 개발을 위해 FK 없이 UUID만 저장 |
| **JSONB 사용** | `selectedLeadIds`가 JSONB 배열이라 FK 적용 불가 |
| **Drizzle ORM 제약** | Drizzle에서 FK 추가 시 마이그레이션 필요 인지 부족 |
| **테스트 부재** | 데이터 삭제 시나리오 테스트 미수행 |

#### 위험도 분석

```
문제 시나리오:
1. 사용자가 customer_group 삭제
2. onboarding_progress.customerGroupId는 여전히 삭제된 그룹 ID 참조
3. 프론트엔드에서 해당 그룹 조회 시 404 에러
4. 온보딩 플로우 중단
```

#### 해결법

**1. 마이그레이션 SQL 생성**

```sql
-- elysia-server/drizzle/migrations/XXXX_add_onboarding_fk_constraints.sql

-- customerGroupId FK 추가
ALTER TABLE onboarding_progress
  ADD CONSTRAINT fk_onboarding_customer_group
    FOREIGN KEY (customer_group_id)
    REFERENCES customer_groups(id)
    ON DELETE SET NULL;

-- generatedSequenceId FK 추가
ALTER TABLE onboarding_progress
  ADD CONSTRAINT fk_onboarding_generated_sequence
    FOREIGN KEY (generated_sequence_id)
    REFERENCES sequences(id)
    ON DELETE SET NULL;

-- 인덱스 추가 (FK 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_onboarding_customer_group
  ON onboarding_progress(customer_group_id)
  WHERE customer_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_generated_sequence
  ON onboarding_progress(generated_sequence_id)
  WHERE generated_sequence_id IS NOT NULL;
```

**2. Drizzle 스키마 수정**

```typescript
// elysia-server/src/db/schema/onboarding.ts

import { customerGroups } from "./customer-groups"
import { sequences } from "./sequences"

export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    // ... 기존 필드들 ...

    // ✅ 수정: FK 제약조건 추가
    customerGroupId: uuid("customer_group_id")
      .references(() => customerGroups.id, { onDelete: "set null" }),

    generatedSequenceId: uuid("generated_sequence_id")
      .references(() => sequences.id, { onDelete: "set null" }),

    // selectedLeadIds는 Junction Table로 분리 (아래 참조)
  },
  // ...
)
```

**3. selectedLeadIds Junction Table 생성 (JSONB 대체)**

```typescript
// elysia-server/src/db/schema/onboarding.ts

export const onboardingSelectedLeads = pgTable(
  "onboarding_selected_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    onboardingProgressId: uuid("onboarding_progress_id")
      .notNull()
      .references(() => onboardingProgress.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    progressIdx: index("idx_onboarding_selected_leads_progress").on(table.onboardingProgressId),
    leadIdx: index("idx_onboarding_selected_leads_lead").on(table.leadId),
    uniqueConstraint: unique("uq_onboarding_selected_lead").on(
      table.onboardingProgressId,
      table.leadId,
    ),
  }),
)
```

**4. 데이터 마이그레이션 스크립트**

```typescript
// elysia-server/scripts/migrate-selected-leads.ts

import { db } from "../src/db"
import { onboardingProgress, onboardingSelectedLeads } from "../src/db/schema/onboarding"

async function migrateSelectedLeads() {
  const allProgress = await db.select().from(onboardingProgress)

  for (const progress of allProgress) {
    if (progress.selectedLeadIds && Array.isArray(progress.selectedLeadIds)) {
      for (const leadId of progress.selectedLeadIds) {
        await db.insert(onboardingSelectedLeads).values({
          onboardingProgressId: progress.id,
          leadId,
        }).onConflictDoNothing()
      }
    }
  }

  console.log("Migration completed!")
}

migrateSelectedLeads()
```

---

### C-03: Trial 데이터 3중 복제

#### 현재 코드

**위치 1:** `users` 테이블

```typescript
// elysia-server/src/db/schema/users.ts
trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
isTrialActive: boolean("is_trial_active").default(false),
```

**위치 2:** `subscriptions` 테이블

```typescript
// elysia-server/src/db/schema/billing.ts
trialStart: timestamp("trial_start", { withTimezone: true }),
trialEnd: timestamp("trial_end", { withTimezone: true }),
```

**위치 3:** `billingPlans` 테이블

```typescript
// elysia-server/src/db/schema/billing.ts
trialDays: integer("trial_days").default(0),
```

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **점진적 기능 추가** | 처음에 users에 trial 추가 → 나중에 billing 시스템 도입 |
| **역할 불명확** | User-level trial vs Workspace-level subscription 구분 안 됨 |
| **하위 호환성 유지** | 기존 코드가 users.trialEndDate 참조 → 제거 못 함 |
| **문서화 부재** | "어느 테이블이 진실 소스인가" 명시 안 됨 |

#### 위험도 분석

```
문제 시나리오:
1. users.trialEndDate = 2025-01-01
2. subscriptions.trialEnd = 2025-01-15 (연장됨)
3. 어떤 코드는 users 참조, 어떤 코드는 subscriptions 참조
4. 사용자는 trial 끝났는데 기능 사용 가능 / 반대 경우도 발생
```

#### 해결법

**1. 진실 소스 결정: `subscriptions` 테이블**

```
[결정 근거]
- Workspace 레벨 구독이 실제 비즈니스 로직
- 결제 시스템과 직접 연동
- 구독 이력 관리 가능
- users.trial*은 deprecated 처리
```

**2. View 생성 (기존 코드 호환)**

```sql
-- elysia-server/drizzle/migrations/XXXX_create_trial_status_view.sql

CREATE OR REPLACE VIEW user_trial_status AS
SELECT
  u.id AS user_id,
  u.email,
  w.id AS workspace_id,
  s.status AS subscription_status,
  s.trial_start,
  s.trial_end,
  CASE
    WHEN s.status = 'trialing' AND s.trial_end > NOW() THEN TRUE
    ELSE FALSE
  END AS is_trial_active,
  CASE
    WHEN s.trial_end IS NOT NULL THEN
      GREATEST(0, EXTRACT(EPOCH FROM (s.trial_end - NOW())) / 86400)::INTEGER
    ELSE 0
  END AS days_remaining
FROM users u
LEFT JOIN workspace_members wm ON u.id = wm.user_id
LEFT JOIN subscriptions s ON wm.workspace_id = s.workspace_id AND s.is_primary = TRUE;
```

**3. 단계적 마이그레이션**

```typescript
// Phase 1: 새 함수 추가 (subscriptions 기반)
export async function getTrialStatus(userId: string) {
  const result = await db
    .select({
      subscriptionStatus: subscriptions.status,
      trialStart: subscriptions.trialStart,
      trialEnd: subscriptions.trialEnd,
    })
    .from(users)
    .innerJoin(workspaceMembers, eq(users.id, workspaceMembers.userId))
    .innerJoin(subscriptions, and(
      eq(workspaceMembers.workspaceId, subscriptions.workspaceId),
      eq(subscriptions.isPrimary, true)
    ))
    .where(eq(users.id, userId))
    .limit(1)

  if (!result[0]) {
    return { isTrialActive: false, daysRemaining: 0 }
  }

  const { trialEnd, subscriptionStatus } = result[0]
  const now = new Date()
  const isTrialActive = subscriptionStatus === "trialing" && trialEnd && trialEnd > now
  const daysRemaining = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  return { isTrialActive, daysRemaining, trialEnd }
}

// Phase 2: 기존 함수에 deprecation 경고
/**
 * @deprecated Use getTrialStatus() instead. This reads from users table which is outdated.
 */
export async function checkTrialStatusLegacy(userId: string) {
  console.warn("[DEPRECATED] checkTrialStatusLegacy - use getTrialStatus instead")
  // ... 기존 코드 ...
}

// Phase 3: 기존 함수 호출부 모두 수정 후 제거
```

**4. users 테이블 필드 deprecated 마킹**

```typescript
// elysia-server/src/db/schema/users.ts

// ⚠️ DEPRECATED: Use subscriptions table instead
// TODO: Remove after 2025-02-01
trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
isTrialActive: boolean("is_trial_active").default(false),
```

---

### C-04: 트랜잭션 없는 다중 테이블 업데이트

#### 현재 코드

**파일:** `elysia-server/src/services/onboarding.service.ts:190-267`

```typescript
// ❌ 현재: 트랜잭션 없이 순차 실행
export async function saveSurveyData(
  workspaceId: string,
  surveyData: OnboardingSurveyData,
  userId?: string,
): Promise<OnboardingProgressData> {
  // 1. 진행 상태 조회/생성
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  // 2. onboarding_progress 업데이트
  const [updated] = await db
    .update(onboardingProgress)
    .set({ surveyData, status: "survey_completed", currentStep: 1 })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  // 3. workspace_sales_strategies 생성 (여기서 실패하면?)
  try {
    await salesStrategyService.findOrCreateAndLinkSalesStrategy(workspaceId, {...})
  } catch (error) {
    console.error("[OnboardingService] ⚠️ Failed to link sales strategy:", error)
    // 실패해도 계속 진행 → 데이터 불일치!
  }

  return updated
}
```

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **try-catch로 에러 무시** | Sales Strategy 실패 시 catch에서 로그만 찍고 계속 진행 |
| **트랜잭션 미사용** | Drizzle의 `db.transaction()` 미활용 |
| **Atomic 연산 인식 부족** | "둘 다 성공하거나 둘 다 실패" 요구사항 미인식 |
| **에러 처리 전략 부재** | 부분 실패 시 롤백/재시도 전략 없음 |

#### 위험도 분석

```
문제 시나리오:
1. saveSurveyData 호출
2. onboarding_progress 업데이트 성공 (status = survey_completed)
3. findOrCreateAndLinkSalesStrategy 실패 (DB 연결 끊김)
4. 에러 로그만 찍고 함수 종료
5. 사용자는 survey 완료로 보이나 sales_strategy 없음
6. Step 1 완료 시 sales_strategy 없어서 추가 로직 실행 필요
```

#### 해결법

**1. Drizzle 트랜잭션 적용**

```typescript
// elysia-server/src/services/onboarding.service.ts

export async function saveSurveyData(
  workspaceId: string,
  surveyData: OnboardingSurveyData,
  userId?: string,
): Promise<OnboardingProgressData> {
  // 필수 필드 검증 (트랜잭션 전에)
  if (!surveyData.industry || !surveyData.target || !surveyData.country || !surveyData.experience) {
    throw new OnboardingValidationError(
      "설문 데이터가 불완전합니다.",
      "INCOMPLETE_SURVEY_DATA",
    )
  }

  // ✅ 트랜잭션으로 atomic 연산 보장
  return await db.transaction(async (tx) => {
    // 1. 진행 상태 조회/생성
    const [existing] = await tx
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.workspaceId, workspaceId))
      .limit(1)

    let progressId: string

    if (existing) {
      progressId = existing.id
    } else {
      const [created] = await tx
        .insert(onboardingProgress)
        .values({ workspaceId, status: "not_started", currentStep: 0 })
        .returning()
      progressId = created.id
    }

    // 2. onboarding_progress 업데이트
    const [updated] = await tx
      .update(onboardingProgress)
      .set({
        surveyData,
        status: "survey_completed",
        currentStep: 1,
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.id, progressId))
      .returning()

    // 3. workspace_sales_strategies 생성 (트랜잭션 내에서)
    // 실패 시 전체 롤백
    await salesStrategyService.findOrCreateAndLinkSalesStrategyWithTx(tx, workspaceId, {
      industry: surveyData.industry,
      target: surveyData.target,
      country: surveyData.country,
      experience: surveyData.experience,
    })

    // 4. Activity Log (트랜잭션 외부에서 실행 가능 - 실패해도 무방)
    // 트랜잭션 성공 후 비동기로 처리
    setImmediate(() => {
      createLog(workspaceId, "onboarding", progressId, "survey_completed", {
        userId,
        details: { surveyData },
      }).catch(console.error)
    })

    return updated as OnboardingProgressData
  })
}
```

**2. Sales Strategy 서비스 트랜잭션 지원**

```typescript
// elysia-server/src/services/sales-strategy.service.ts

import type { PgTransaction } from "drizzle-orm/pg-core"

// 기존 함수 유지 (하위 호환)
export async function findOrCreateAndLinkSalesStrategy(
  workspaceId: string,
  params: SalesStrategyParams,
) {
  return db.transaction((tx) => findOrCreateAndLinkSalesStrategyWithTx(tx, workspaceId, params))
}

// 트랜잭션 지원 버전 추가
export async function findOrCreateAndLinkSalesStrategyWithTx(
  tx: PgTransaction<any, any, any>,
  workspaceId: string,
  params: SalesStrategyParams,
) {
  // 1. 기존 전략 검색
  const [existing] = await tx
    .select()
    .from(salesStrategies)
    .where(and(
      eq(salesStrategies.industry, params.industry),
      eq(salesStrategies.target, params.target),
      eq(salesStrategies.country, params.country),
      eq(salesStrategies.experience, params.experience),
    ))
    .limit(1)

  let strategyId: string

  if (existing) {
    strategyId = existing.id
  } else {
    // 새 전략 생성
    const [created] = await tx
      .insert(salesStrategies)
      .values({
        industry: params.industry,
        target: params.target,
        country: params.country,
        experience: params.experience,
      })
      .returning()
    strategyId = created.id
  }

  // 2. 워크스페이스에 연결
  await tx
    .insert(workspaceSalesStrategies)
    .values({ workspaceId, salesStrategyId: strategyId })
    .onConflictDoNothing()

  return strategyId
}
```

---

## High Priority Issues

---

### H-01: 온보딩 상태/스텝 불일치

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **두 필드 독립 관리** | `status`와 `currentStep`이 별도로 업데이트됨 |
| **DB 레벨 검증 없음** | 애플리케이션 레벨에서만 일관성 유지 시도 |
| **수동 업데이트 가능** | Admin API나 직접 DB 수정으로 불일치 유발 |

#### 해결법

```sql
-- elysia-server/drizzle/migrations/XXXX_add_status_step_constraint.sql

ALTER TABLE onboarding_progress
  ADD CONSTRAINT check_status_step_consistency
  CHECK (
    (status = 'not_started' AND current_step = 0) OR
    (status = 'survey_completed' AND current_step >= 1 AND current_step <= 5) OR
    (status = 'company_info' AND current_step >= 2 AND current_step <= 5) OR
    (status = 'lead_search' AND current_step >= 3 AND current_step <= 5) OR
    (status = 'email_generation' AND current_step >= 4 AND current_step <= 5) OR
    (status = 'email_link' AND current_step >= 4 AND current_step <= 5) OR
    (status = 'completed' AND current_step = 5)
  );
```

---

### H-02: SSE 연결 재시도 로직 부재

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **EventSource 기본 동작** | 브라우저 EventSource는 자동 재연결하나, 에러 시 무한 루프 가능 |
| **커스텀 훅 사용** | React Query의 SSE 지원이 아닌 직접 구현 |
| **네트워크 에러 미처리** | 연결 끊김 시 상태 업데이트 없음 |

#### 해결법

```typescript
// admin/src/lib/api/hooks/useOnboardingSSE.ts

import { useCallback, useEffect, useRef, useState } from "react"

interface SSEState {
  phase: string
  progressPercent: number
  isComplete: boolean
  error: string | null
  isConnected: boolean
}

export function useOnboardingSSE(workspaceId: string | null) {
  const [state, setState] = useState<SSEState>({
    phase: "init",
    progressPercent: 0,
    isComplete: false,
    error: null,
    isConnected: false,
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const MAX_RETRIES = 5
  const BASE_DELAY = 1000 // 1초

  const connect = useCallback(() => {
    if (!workspaceId) return

    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `${API_BASE_URL}/onboarding/workspace/${workspaceId}/stream`
    const eventSource = new EventSource(url, { withCredentials: true })
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log("[SSE] Connected")
      retryCountRef.current = 0
      setState((prev) => ({ ...prev, isConnected: true, error: null }))
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setState((prev) => ({
          ...prev,
          phase: data.phase || prev.phase,
          progressPercent: data.progressPercent ?? prev.progressPercent,
          isComplete: data.phase === "complete",
        }))

        if (data.phase === "complete") {
          eventSource.close()
        }
      } catch (e) {
        console.error("[SSE] Parse error:", e)
      }
    }

    eventSource.onerror = (error) => {
      console.error("[SSE] Error:", error)
      eventSource.close()
      setState((prev) => ({ ...prev, isConnected: false }))

      // Exponential backoff 재시도
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCountRef.current)
        console.log(`[SSE] Retrying in ${delay}ms (attempt ${retryCountRef.current + 1})`)

        retryTimeoutRef.current = setTimeout(() => {
          retryCountRef.current++
          connect()
        }, delay)
      } else {
        setState((prev) => ({
          ...prev,
          error: "연결이 끊어졌습니다. 페이지를 새로고침해주세요.",
        }))
      }
    }
  }, [workspaceId])

  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [connect])

  // 수동 재연결 함수
  const reconnect = useCallback(() => {
    retryCountRef.current = 0
    setState((prev) => ({ ...prev, error: null }))
    connect()
  }, [connect])

  return { ...state, reconnect }
}
```

---

### H-03: 설문 데이터 이중 저장

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **레거시 호환** | 처음에 users.onboardingSurvey 사용 → 나중에 onboarding_progress 추가 |
| **두 곳에서 참조** | 일부 코드는 users, 일부는 onboarding_progress 참조 |

#### 해결법

```typescript
// 1. users.onboardingSurvey 필드 deprecated
// 2. 모든 참조를 onboarding_progress.surveyData로 변경
// 3. 마이그레이션 스크립트로 데이터 동기화 후 users 필드 제거

// elysia-server/scripts/migrate-survey-data.ts
async function migrateSurveyData() {
  const usersWithSurvey = await db
    .select()
    .from(users)
    .where(isNotNull(users.onboardingSurvey))

  for (const user of usersWithSurvey) {
    // 해당 사용자의 workspace 찾기
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.id))
      .limit(1)

    if (!workspace) continue

    // onboarding_progress에 surveyData가 없으면 복사
    const [progress] = await db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.workspaceId, workspace.id))
      .limit(1)

    if (progress && !progress.surveyData) {
      await db
        .update(onboardingProgress)
        .set({ surveyData: user.onboardingSurvey })
        .where(eq(onboardingProgress.id, progress.id))
    }
  }
}
```

---

### H-04: 타임존 하드코딩

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **빠른 개발** | "일단 KST로 하드코딩하고 나중에 수정" |
| **글로벌 사용자 미고려** | 한국 사용자만 가정 |

#### 해결법

```typescript
// 1. date-fns-tz 설치
// bun add date-fns-tz

// 2. 유틸 함수 생성
// elysia-server/src/lib/utils/timezone.ts

import { formatInTimeZone, toZonedTime } from "date-fns-tz"

export function getUserTimezone(userId: string): string {
  // TODO: users 테이블에 timezone 필드 추가 후 조회
  // 현재는 기본값 반환
  return process.env.DEFAULT_TIMEZONE || "Asia/Seoul"
}

export function toUserLocalTime(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone)
}

export function formatUserLocalTime(date: Date, timezone: string, format: string): string {
  return formatInTimeZone(date, timezone, format)
}

// 3. 기존 하드코딩 대체
// Before:
// const KST_OFFSET_MS = 9 * 60 * 60 * 1000

// After:
import { getUserTimezone, toUserLocalTime } from "../lib/utils/timezone"

const userTimezone = getUserTimezone(userId)
const localTime = toUserLocalTime(new Date(), userTimezone)
```

---

### H-05: Email Account Race Condition

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **비동기 콜백** | Nylas OAuth callback과 프론트엔드 요청이 동시 발생 |
| **락 없음** | DB 레벨 락이나 분산 락 미사용 |

#### 해결법

```typescript
// 1. Advisory Lock 사용 (PostgreSQL)
// elysia-server/src/services/email-account.service.ts

async function createEmailAccountWithLock(
  workspaceId: string,
  data: CreateEmailAccountData,
) {
  // Advisory lock 키 생성 (workspace별)
  const lockKey = hashString(`email_account_${workspaceId}`)

  return await db.transaction(async (tx) => {
    // Advisory lock 획득 (세션 레벨)
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`)

    // 기존 계정 확인
    const [existing] = await tx
      .select()
      .from(userEmailAccounts)
      .where(and(
        eq(userEmailAccounts.workspaceId, workspaceId),
        eq(userEmailAccounts.emailAddress, data.emailAddress),
      ))
      .limit(1)

    if (existing) {
      // 이미 존재하면 업데이트
      const [updated] = await tx
        .update(userEmailAccounts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userEmailAccounts.id, existing.id))
        .returning()
      return updated
    }

    // 새로 생성
    const [created] = await tx
      .insert(userEmailAccounts)
      .values(data)
      .returning()
    return created
  })
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}
```

---

### H-06: Audit Trail 부재

#### 핵심 원인

| 원인 | 설명 |
|------|------|
| **설계 누락** | 온보딩 상태 변경 이력 요구사항 없었음 |
| **Activity Log 부족** | 현재 Activity Log는 성공 케이스만 기록 |

#### 해결법

```typescript
// 1. 히스토리 테이블 추가
// elysia-server/src/db/schema/onboarding.ts

export const onboardingProgressHistory = pgTable(
  "onboarding_progress_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    onboardingProgressId: uuid("onboarding_progress_id")
      .notNull()
      .references(() => onboardingProgress.id, { onDelete: "cascade" }),
    previousStatus: onboardingStatusEnum("previous_status"),
    newStatus: onboardingStatusEnum("new_status").notNull(),
    previousStep: integer("previous_step"),
    newStep: integer("new_step").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    changeReason: text("change_reason"), // "user_action", "api_call", "job_complete", "timeout"
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    progressIdx: index("idx_onboarding_history_progress").on(table.onboardingProgressId),
    statusIdx: index("idx_onboarding_history_status").on(table.newStatus),
    createdAtIdx: index("idx_onboarding_history_created").on(table.createdAt),
  }),
)

// 2. 자동 기록 함수
export async function recordOnboardingChange(
  tx: PgTransaction<any, any, any>,
  progressId: string,
  previousStatus: OnboardingStatus | null,
  newStatus: OnboardingStatus,
  previousStep: number | null,
  newStep: number,
  changedBy?: string,
  reason?: string,
  metadata?: Record<string, unknown>,
) {
  await tx.insert(onboardingProgressHistory).values({
    onboardingProgressId: progressId,
    previousStatus,
    newStatus,
    previousStep,
    newStep,
    changedBy,
    changeReason: reason,
    metadata,
  })
}
```

---

## Medium Priority Issues

### M-01 ~ M-10 요약

| ID | 문제 | 해결법 요약 |
|----|------|------------|
| M-01 | Auto-save 경쟁 조건 | React Query `useMutation` + debounce 적용 |
| M-02 | Discovery Job 실패 허용 | 경고 토스트 + 수동 재시도 버튼 추가 |
| M-03 | Error Boundary 부재 | React Error Boundary 컴포넌트 래핑 |
| M-04 | Rate Limiting 없음 | Elysia rate-limit 플러그인 적용 |
| M-05 | Magic Numbers | `config/onboarding.ts` 파일로 추출 |
| M-06 | 인덱스 누락 | 마이그레이션으로 인덱스 추가 |
| M-07 | Checkpoint DB 미저장 | `onboarding_progress.checkpoint` JSONB 필드 추가 |
| M-08 | 폼 검증 미흡 | Zod + react-hook-form 통합 |
| M-09 | URL 하드코딩 | 환경 변수로 이동 |
| M-10 | 네트워크 체크 없음 | `navigator.onLine` 체크 추가 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-22 | 초기 문서 작성 - 20개 이슈 근본 원인 분석 |
