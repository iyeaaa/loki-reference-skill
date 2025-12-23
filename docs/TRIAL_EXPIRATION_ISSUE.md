# 체험판 만료 처리 문제 요약

> PR #469 (이메일 오픈 알림) 리뷰 중 발견된 체험판 시스템 설계 문제

**발견일**: 2025-12-23
**심각도**: 🔴 High (보안/과금 이슈)

---

## 🎯 3줄 요약

1. **체험판 상태가 3개 필드에 중복** - 동기화 안됨
2. **자동 만료 처리 없음** - 만료되어도 DB 업데이트 안됨
3. **결과**: 만료된 사용자가 계속 체험판 기능 사용 가능 💸

---

## 🔴 가장 큰 문제

### 체험판 관리가 여러 필드에서 일어남

```
┌─────────────────────┬────────────────┬─────────────────────────────┐
│ 필드                 │ 어디서 관리    │ 무엇을 관리                  │
├─────────────────────┼────────────────┼─────────────────────────────┤
│ users.               │ user.service   │ • 가입 시 is_trial_active   │
│ is_trial_active      │                │   = true 설정               │
│                      │                │ • 워크스페이스 자동 생성    │
│                      │                │ • 체험판 연장 함수          │
│                      │                │ ❌ 만료 시 자동 업데이트 안함│
├─────────────────────┼────────────────┼─────────────────────────────┤
│ subscriptions.       │ billing.       │ • 구독 생성 시 status =     │
│ status               │ service        │   "trialing" 설정           │
│                      │ workspace.     │ • IAM 권한 체크             │
│                      │ service        │ • 이메일 오픈 알림 (PR 469) │
│                      │                │ ❌ 만료 시 자동 업데이트 안함│
├─────────────────────┼────────────────┼─────────────────────────────┤
│ workspaces.          │ workspace.     │ • subscriptions의 캐시      │
│ subscription_status  │ service        │ • 빠른 IAM 권한 체크용      │
│                      │                │ ❌ 수동 동기화 필요          │
└─────────────────────┴────────────────┴─────────────────────────────┘

🚨 문제: 세 필드가 서로 다른 값을 가질 수 있음!
```

### 예시: 만료된 체험판 사용자의 현재 상태

```typescript
// 2025-12-23 기준, trial_end_date = 2025-12-16 (만료됨)

// 실제 DB 상태
users.is_trial_active = true              // ❌ 여전히 true
users.trial_end_date = 2025-12-16         // ✅ 만료됨

subscriptions.status = "trialing"         // ❌ 여전히 trialing
subscriptions.trial_end = 2025-12-16      // ✅ 만료됨

workspaces.subscription_status = "trialing"  // ❌ 여전히 trialing

// 기대하는 상태
users.is_trial_active = false
subscriptions.status = "canceled" (또는 "active")
workspaces.subscription_status = "canceled"
```

**결과**: 이 사용자는 만료되었지만 계속 체험판 기능(이메일 알림 등)을 사용할 수 있음

---

## 🔍 발견된 문제들

### 1. 체험판 상태 필드 중복 (3개!)

| 필드 | 테이블 | 레벨 | 용도 |
|------|--------|------|------|
| `is_trial_active` | users | 사용자 | 가입/온보딩, 워크스페이스 자동생성 |
| `status` | subscriptions | 구독 | **결제/구독 관리**, IAM 권한, **이메일 알림** |
| `subscription_status` | workspaces | 워크스페이스 | 캐시 (성능 최적화용) |

**문제점:**
- 세 필드의 동기화가 보장되지 않음
- 어떤 필드를 사용해야 하는지 불명확
- 데이터 불일치 가능성

### 2. 자동 만료 처리 없음 ⚠️

**현재 구현:**
```typescript
// user.service.ts:1139-1141
const now = new Date()
const isTrialExpired = user.trialEndDate && now > user.trialEndDate
return { ...user, isTrialExpired }  // 계산만 하고 DB 업데이트 안함!
```

**문제점:**
- `trialEndDate`를 체크하는 것은 `getTrialStatus()` 함수가 호출될 때만
- 만료되어도 DB의 `is_trial_active`, `subscriptions.status`는 그대로 유지
- **정기적으로 만료를 체크하는 워커/크론잡이 없음**

---

## 💥 영향도

### 1. 비즈니스 영향
```
❌ 만료된 체험판 사용자가:
   - 계속 이메일 오픈 알림을 받음 (PR #469)
   - 체험판 전용 기능을 계속 사용 가능
   - 무료로 서비스를 계속 이용 가능
```

### 2. 데이터 정합성
```
현재 상태:
  users.is_trial_active = true
  users.trial_end_date = 2025-12-16 (만료됨)
  subscriptions.status = "trialing"
  workspaces.subscription_status = "trialing"

기대 상태:
  users.is_trial_active = false
  subscriptions.status = "active" or "canceled"
  workspaces.subscription_status = "active" or "canceled"
```

### 3. 코드 복잡도
- 3곳의 필드를 관리해야 함
- 새로운 기능 추가 시 어떤 필드를 사용해야 하는지 혼란
- Git 히스토리: 여러 번 추가/제거/재구현됨 (PR #246, #268, #269, #270, #271, #272, #274)

---

## ✅ 해결 방안

### 우선순위 1: 긴급 수정 (이메일 알림)

**PR #469에 추가:**
```typescript
// email-open-notification.service.ts
export async function isTrialWorkspace(workspaceId: string): Promise<boolean> {
  const [subscription] = await db
    .select({
      status: subscriptions.status,
      trialEnd: subscriptions.trialEnd  // 추가
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.status, "trialing"),
        eq(subscriptions.isPrimary, true),
      ),
    )
    .limit(1)

  if (!subscription) return false

  // 만료 체크 추가
  const now = new Date()
  if (subscription.trialEnd && subscription.trialEnd < now) {
    return false  // 만료됨
  }

  return true
}
```

**영향:**
- 만료된 체험판 사용자는 이메일 알림을 받지 않음
- 다른 기능은 여전히 영향 있음

---

### 우선순위 2: 자동 만료 워커 추가

**새 파일 생성:** `src/workers/bullmq/trial-expiration.worker.ts`

```typescript
/**
 * 체험판 만료 자동 처리 워커
 * - 매 시간마다 실행
 * - 만료된 체험판을 찾아서 상태 업데이트
 */
import { Queue, Worker } from "bullmq"

// 1. 만료된 구독 찾기
const expiredSubscriptions = await db
  .select()
  .from(subscriptions)
  .where(
    and(
      eq(subscriptions.status, "trialing"),
      lt(subscriptions.trialEnd, new Date())
    )
  )

// 2. 상태 업데이트
for (const sub of expiredSubscriptions) {
  await db.update(subscriptions)
    .set({
      status: "canceled",  // 또는 "active" (자동 결제 설정에 따라)
      updatedAt: new Date()
    })
    .where(eq(subscriptions.id, sub.id))

  // 3. 워크스페이스 캐시 업데이트
  await db.update(workspaces)
    .set({ subscriptionStatus: "canceled" })
    .where(eq(workspaces.id, sub.workspaceId))

  // 4. users.is_trial_active 업데이트
  // (workspace owner 찾아서 업데이트)
}
```

**스케줄링:**
```typescript
// worker.ts
import { CronJob } from "cron"

new CronJob("0 * * * *", async () => {  // 매 시간
  await trialExpirationQueue.add("check-expired-trials", {})
}).start()
```

---

### 우선순위 3: 필드 통합 (장기 과제)

**목표:** `users.is_trial_active` 제거, 두 개 필드만 사용

1. **`subscriptions.status`** (원본) - 실제 구독 상태
2. **`workspaces.subscription_status`** (캐시) - 빠른 조회용

**마이그레이션 계획:**
1. `users.is_trial_active` 사용하는 곳 찾기
2. `subscriptions.status` 또는 계산 로직으로 대체
3. 필드 deprecated 표시
4. 충분한 테스트 후 제거

---

## 🧪 테스트 체크리스트

### 긴급 수정 테스트
- [ ] 체험판 사용자 (만료 전): 알림 발송 O
- [ ] 체험판 사용자 (만료 후): 알림 발송 X
- [ ] 유료 사용자: 알림 발송 X

### 워커 테스트
- [ ] 만료 1시간 전: 상태 그대로
- [ ] 만료 직후: 워커가 상태를 "canceled"로 변경
- [ ] 세 필드 모두 동기화됨 확인
- [ ] 로그 확인: 몇 개의 구독이 만료 처리되었는지

---

## 📊 영향 범위 분석

### 코드 위치
```
src/services/email-open-notification.service.ts:348-361  # isTrialWorkspace()
src/services/user.service.ts:73,916                      # 가입 시 is_trial_active 설정
src/services/user.service.ts:955                         # 워크스페이스 자동 생성
src/services/user.service.ts:1139-1152                   # getTrialStatus() (만료 체크)
src/services/billing.service.ts                          # 구독 관리
src/services/iam.service.ts                              # 권한 체크
```

### DB 스키마
```
users.is_trial_active          (boolean, default: false)
users.trial_start_date         (timestamp)
users.trial_end_date           (timestamp)

subscriptions.status           (enum: trialing/active/canceled/...)
subscriptions.trial_start      (timestamp)
subscriptions.trial_end        (timestamp)

workspaces.subscription_status (enum, 캐시용)
workspaces.subscription_tier   (enum, 캐시용)
```

---

## 🎯 권장 조치

### 즉시 (이번 주)
1. ✅ PR #469에 만료 체크 로직 추가
2. ✅ 테스트 및 배포

### 단기 (1-2주)
3. ⬜ 자동 만료 워커 구현
4. ⬜ 스테이징 환경 테스트
5. ⬜ 프로덕션 배포 및 모니터링

### 중기 (1개월)
6. ⬜ `users.is_trial_active` 사용처 파악
7. ⬜ 마이그레이션 계획 수립
8. ⬜ 점진적 필드 제거

---

## 📚 참고

- PR #469: Add email notifications for trial SDR agent
- Git History: 체험판 기능이 여러 번 추가/제거/재추가됨
  - 05984f7 feat: essential backend dev for 7 day trial users (#274)
  - 30ed1e8 Revert (#272)
  - 27702c3 feat (#271)
  - 8278fed Revert (#270)
  - ...

**관련 문서:**
- `src/db/schema/users.ts:58-61` - Trial period fields
- `src/db/schema/billing.ts:181-249` - Subscriptions table
- `src/db/schema/workspaces.ts:60-78` - Subscription cache fields
