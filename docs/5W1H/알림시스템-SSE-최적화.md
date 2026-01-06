# 알림 시스템 SSE 최적화

> 작성일: 2026-01-06

---

## 1. 최적화된 아키텍처

### 기존 구조 (이중 SSE)

```
Worker → Redis PubSub → Onboarding SSE → StepBuyerLoading
Worker → DB → Notification SSE → NotificationBell

문제점:
- 두 개의 SSE 연결 (리소스 낭비)
- DB 저장으로 인한 50-150ms 지연
- 진행률 불일치
```

### 최적화된 구조 (단일 SSE + Redis 캐싱)

```
┌─────────────────────────────────────────────────────────────────┐
│                     OPTIMIZED SSE ARCHITECTURE                   │
│                                                                  │
│  Worker                                                          │
│    └─▶ emitOnboardingProgress(event)                             │
│          ├─▶ Redis PubSub (실시간 브로드캐스트)                  │
│          └─▶ Redis SET (상태 캐싱, TTL 1시간)                    │
│                                                                  │
│  SSE Endpoint: /api/v1/onboarding/workspace/{id}/stream          │
│    └─▶ On Connect:                                               │
│          ├─▶ Redis GET → 캐시된 상태 즉시 전송 (재접속 지원)     │
│          └─▶ PubSub Subscribe → 실시간 업데이트                  │
│                                                                  │
│  Frontend: Jotai Store (onboarding-progress.ts)                  │
│    ├─▶ StepBuyerLoading (SSE 연결 관리)                          │
│    └─▶ NotificationBell (읽기 전용, 필요시 SSE 연결)             │
│                                                                  │
│  DB 저장: 완료/에러 시만 (히스토리용)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 핵심 변경 사항

### 2.1 백엔드: Redis 상태 캐싱

**파일**: `elysia-server/src/lib/redis/onboarding-events.ts`

```typescript
// 새로운 상수
export const ONBOARDING_STATE_PREFIX = "onboarding:state:"
export const ONBOARDING_STATE_TTL = 3600 // 1시간

// emitOnboardingProgress 개선
export async function emitOnboardingProgress(event): Promise<void> {
  const stateKey = getOnboardingStateKey(event.workspaceId)

  // 1. PubSub 발행 (실시간)
  await publisher.publish(channel, eventJson)

  // 2. Redis 캐시 저장 (재접속용)
  const ttl = event.phase === "complete" || event.phase === "error" ? 300 : 3600
  await publisher.setex(stateKey, ttl, eventJson)
}

// 캐시 조회 함수 추가
export async function getCachedOnboardingState(workspaceId): Promise<Event | null>
```

### 2.2 백엔드: SSE 엔드포인트 개선

**파일**: `elysia-server/src/routes/onboarding.routes.ts`

```typescript
// SSE 연결 시 캐시된 상태 즉시 전송
const cachedState = await getCachedOnboardingState(workspaceId)

if (cachedState) {
  safeEnqueue(`event: cached\ndata: ${JSON.stringify(cachedState)}\n\n`)

  // 완료/에러 상태면 스트림 종료
  if (cachedState.phase === "complete" || cachedState.phase === "error") {
    // ... close stream
  }
}
```

### 2.3 백엔드: 알림 DB 저장 최적화

**파일**: `elysia-server/src/services/onboarding-worker.service.ts`

```typescript
async function emitAndSaveNotification(event, userId): Promise<void> {
  // 1. 항상 SSE emit (Redis 캐시 포함)
  await emitOnboardingProgress(event)

  // 2. 완료/에러 시만 DB 저장 (히스토리용)
  if (event.phase === "complete" || event.phase === "error") {
    await upsertOnboardingProgressNotification(userId, event)
  }
}
```

### 2.4 프론트엔드: 통합 Progress Store

**파일**: `admin/src/store/onboarding-progress.ts`

```typescript
// Phase별 Fake Progress 범위
export const PHASE_PROGRESS_RANGES = {
  init: { min: 0, max: 5 },
  discovery: { min: 5, max: 30 },
  group: { min: 30, max: 45 },
  templates: { min: 45, max: 65 },
  sequence: { min: 65, max: 75 },
  previews: { min: 75, max: 95 },
  complete: { min: 100, max: 100 },
  error: { min: -1, max: -1 },
}

// 통합 Hook
export function useOnboardingProgress(workspaceId, options)

// 읽기 전용 Hook (NotificationBell용)
export function useOnboardingProgressReadOnly(workspaceId)
```

### 2.5 프론트엔드: StepBuyerLoading

**파일**: `admin/src/pages/app/components/StepBuyerLoading.tsx`

```typescript
// 기존: useOnboardingSSE + useSharedFakeProgress
// 변경: 통합 Hook 사용
const {
  phase,
  displayProgress, // Fake Progress 포함
  message,
  leads,
  isComplete,
  hasError,
} = useOnboardingProgress(workspaceId, { enabled: shouldEnableSSE })
```

### 2.6 프론트엔드: NotificationBell

**파일**: `admin/src/components/NotificationBell.tsx`

```typescript
// 통합 Store에서 실시간 진행률 읽기
const progressState = useOnboardingProgressReadOnly(workspaceId)

// StepBuyerLoading 없을 때 SSE 연결
const shouldConnectSSE = hasInProgressOnboarding && !progressState.isConnected
useOnboardingProgress(workspaceId, { enabled: shouldConnectSSE })
```

---

## 3. 데이터 흐름

### 3.1 정상 케이스 (페이지 유지)

```
시간  │ Worker              │ Redis                │ Frontend
──────┼─────────────────────┼──────────────────────┼─────────────────
0ms   │ emit(25%)           │                      │
5ms   │                     │ PubSub + SET         │
10ms  │                     │                      │ SSE 수신 (25%)
15ms  │                     │                      │ UI 업데이트
```

**지연: ~15ms** (기존 50-150ms에서 개선)

### 3.2 페이지 새로고침/재접속

```
시간  │ Frontend            │ Redis                │
──────┼─────────────────────┼──────────────────────┼
0ms   │ SSE 연결 시작       │                      │
10ms  │                     │ GET cached state     │
15ms  │ cached 이벤트 수신  │                      │
20ms  │ UI 즉시 복원 (25%)  │                      │
...   │ 실시간 업데이트     │ PubSub 구독          │
```

### 3.3 완료/에러 케이스

```
시간  │ Worker              │ Redis + DB           │ Frontend
──────┼─────────────────────┼──────────────────────┼─────────────────
0ms   │ emit(complete)      │                      │
5ms   │                     │ PubSub + SET(5분TTL) │
10ms  │                     │                      │ SSE 수신 (100%)
15ms  │                     │ DB INSERT            │
50ms  │                     │                      │ 알림 히스토리 갱신
```

---

## 4. 개선 효과

| 항목 | 기존 | 최적화 후 |
|------|------|----------|
| SSE 연결 수 | 2개 | 1개 |
| 진행률 지연 | 50-150ms | ~15ms |
| DB 저장 횟수 | 매 이벤트 | 완료/에러만 |
| 재접속 복원 | 불가 | 즉시 복원 |
| 진행률 동기화 | 불일치 가능 | 항상 동기화 |
| Fake Progress | 15%까지 | Phase별 범위 |

---

## 5. 파일 변경 요약

### 백엔드

| 파일 | 변경 내용 |
|------|----------|
| `elysia-server/src/lib/redis/onboarding-events.ts` | Redis 캐싱 함수 추가 |
| `elysia-server/src/routes/onboarding.routes.ts` | SSE 연결 시 캐시 전송 |
| `elysia-server/src/services/onboarding-worker.service.ts` | DB 저장 최적화 |

### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `admin/src/store/onboarding-progress.ts` | 새 통합 Store 생성 |
| `admin/src/pages/app/components/StepBuyerLoading.tsx` | 통합 Hook 사용 |
| `admin/src/components/NotificationBell.tsx` | 통합 Store 사용 |

### 삭제 가능 (미사용)

| 파일 | 이유 |
|------|------|
| `admin/src/store/fake-progress.ts` | 통합 Store로 대체됨 |
| `admin/src/store/notifications.ts` (일부) | 온보딩 관련 부분 불필요 |

---

## 6. 향후 개선 가능 사항

1. **WebSocket 전환**: SSE → WebSocket으로 양방향 통신
2. **Redis Streams**: PubSub 대신 Streams로 메시지 영속성
3. **Service Worker**: 백그라운드에서 SSE 유지

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-06 | 초기 최적화 구현 |
