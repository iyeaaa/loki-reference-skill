# 온보딩 알림 시스템 (Redis SSE) 분석

> 작성일: 2026-01-06

---

## 1. 시스템 아키텍처

```
┌─────────────┐     Redis PubSub      ┌─────────────┐      SSE        ┌─────────────┐
│   BullMQ    │ ──────────────────▶  │  API Server │ ─────────────▶ │  Frontend   │
│   Worker    │   emitOnboarding     │   (Elysia)  │   /stream      │   (React)   │
│             │   Progress()         │             │                │             │
└─────────────┘                      └─────────────┘                └─────────────┘
```

### 채널 구조

```typescript
// Redis Channel
"onboarding:progress:{workspaceId}"
```

---

## 2. 백엔드 핵심 파일

| 파일 | 역할 |
|------|------|
| `elysia-server/src/lib/redis/onboarding-events.ts` | 이벤트 발행/구독 + 메시지 헬퍼 |
| `elysia-server/src/routes/onboarding.routes.ts` | SSE 엔드포인트 (`/stream`) |
| `elysia-server/src/services/onboarding-worker.service.ts` | Worker에서 emit 호출 |

---

## 3. 이벤트 타입 정의

### OnboardingPhase (단계)

```typescript
type OnboardingPhase =
  | "init"       // 초기화
  | "discovery"  // 바이어 탐색
  | "group"      // 리드 그룹화ㅡ
  | "templates"  // 이메일 템플릿 생성
  | "sequence"   // 시퀀스 생성
  | "previews"   // 프리뷰 이메일 생성
  | "complete"   // 완료
  | "error"      // 오류
```

### OnboardingProgressEvent (이벤트 구조)

```typescript
interface OnboardingProgressEvent {
  workspaceId: string
  jobId: string
  phase: OnboardingPhase
  progressPercent: number       // 0-100 (에러시 -1)
  message: string               // 영문 메시지
  messageKr: string             // 한글 메시지
  timestamp: string             // ISO 8601
  details: {
    // Discovery
    leadsFound?: number
    leadsEnriched?: number
    // Templates
    templatesGenerated?: number
    totalTemplates?: number
    // Previews
    previewsGenerated?: number
    totalPreviews?: number
    // Real-time tracking
    leads?: LeadProgressItem[]
    currentLead?: LeadProgressItem
    emails?: EmailProgressItem[]
    recentEmail?: EmailProgressItem
    // Error
    error?: string
  }
}
```

### LeadProgressItem (리드 실시간 추적)

```typescript
interface LeadProgressItem {
  leadId: string
  companyName: string
  country?: string
  status: "discovering" | "enriching" | "generating" | "done" | "error"
  email?: string
  emailCount?: number
  leadSource?: "b2b" | "apollo" | "fresh" | "revation" | "perplexity" | "hunterio-discover"
}
```

### EmailProgressItem (이메일 실시간 추적)

```typescript
interface EmailProgressItem {
  emailId: string
  leadId: string
  companyName: string
  subject: string
  step: number
  status: "generating" | "done"
}
```

---

## 4. 단계별 진행률 및 메시지

### 4.1 Discovery Phase (5% → 30%)

| 함수 | % | 영문 | 한글 |
|------|---|------|------|
| `createDiscoveryStartEvent` | 5% | Starting buyer search... | 바이어 찾기 시작 |
| `createDiscoverySearchingEvent` | 10% | Searching database... | 데이터베이스 검색 중 |
| `createDiscoveryBatchEvent` | 0-100%* | Found {n} buyers | {n}명 찾았어요 / 벌써 {n}명이에요 |
| `createDiscoveryCompleteEvent` | 30% | Found {n} buyers | {n}명 다 찾았어요 ✓ |

*Discovery Batch 진행률 계산:
```typescript
progressPercent = Math.min((leadsFound / 30) * 100, 100)
```

### 4.2 Group Phase (35% → 40%)

| 함수 | % | 영문 | 한글 |
|------|---|------|------|
| `createGroupStartEvent` | 35% | Organizing buyer list... | 리스트 정리하는 중 |
| `createGroupCompleteEvent` | 40% | {n} buyers organized | {n}명 리스트 완료 ✓ |

### 4.3 Templates Phase (45% → 65%)

| 함수 | % | 영문 | 한글 |
|------|---|------|------|
| `createTemplatesStartEvent` | 45% | Writing emails... | 이메일 쓰는 중 |
| `createTemplateProgressEvent` | 45-65%* | Writing email {n} of {total}... | {첫/두 번째} 이메일 완료 |
| `createTemplatesCompleteEvent` | 65% | Email templates ready | 템플릿 준비 완료 ✓ |

*Templates 진행률 계산:
```typescript
progressPercent = 45 + (current / total) * 20
```

### 4.4 Sequence Phase (70% → 75%)

| 함수 | % | 영문 | 한글 |
|------|---|------|------|
| `createSequenceStartEvent` | 70% | Setting up campaign... | 발송 일정 설정 중 |
| `createSequenceCompleteEvent` | 75% | {n}-step campaign ready | {n}단계 캠페인 완료 ✓ |

### 4.5 Previews Phase (78% → 95%)

| 함수 | % | 영문 | 한글 |
|------|---|------|------|
| `createPreviewsStartEvent` | 78% | Writing {n} emails... | 이메일 쓰는 중 |
| `createPreviewProgressEvent` | 78-95%* | {n} of {total} emails done | {n}개 완료, {remaining}개 남았어요 |
| `createPreviewsCompleteEvent` | 95% | {n} emails ready | {n}개 이메일 완료 ✓ |

*Previews 진행률 계산:
```typescript
progressPercent = 78 + (generated / total) * 17
```

### 4.6 Complete Phase (100%)

| 함수 | % | 영문 | 한글 |
|------|---|------|------|
| `createCompleteEvent` | 100% | Done! {n} buyers ready | 다 됐어요! 바이어 {n}명 준비 완료 |
| `createCompleteWithDetailsEvent` | 100% | Done! {n} buyers, {m} emails | 다 됐어요! 바이어 {n}명, 이메일 {m}개 준비 완료 |

### 4.7 Error Phase

| 함수 | % | 영문 | 한글 |
|------|---|------|------|
| `createErrorEvent` | -1 | Something went wrong. Please try again. | 잠깐 문제가 생겼어요. 다시 시도해 주세요 |

---

## 5. 실시간 리드/이메일 추적 이벤트

### 5.1 리드 발견

```typescript
createLeadDiscoveredEvent(workspaceId, jobId, lead, allLeads, totalTarget)
// progressPercent: 5 + (allLeads.length / totalTarget) * 25 (최대 30%)
// messageKr: "{companyName} 발견"
```

### 5.2 리드 심화 중

```typescript
createLeadEnrichingEvent(workspaceId, jobId, lead, allLeads, enrichedCount, totalTarget)
// progressPercent: 30 + (enrichedCount / totalTarget) * 20 (최대 50%)
// messageKr: "{companyName} 담당자 찾는 중"
```

### 5.3 리드 심화 완료

```typescript
createLeadEnrichedEvent(workspaceId, jobId, lead, allLeads, enrichedCount, totalTarget)
// progressPercent: 30 + (enrichedCount / totalTarget) * 25 (최대 55%)
// messageKr: "{companyName} 담당자 찾았어요"
```

### 5.4 이메일 생성 중

```typescript
createEmailGeneratingEvent(workspaceId, jobId, lead, allLeads, emailsGenerated, totalEmails)
// progressPercent: 55 + (emailsGenerated / totalEmails) * 40 (최대 95%)
// messageKr: "{companyName} 이메일 쓰는 중"
```

### 5.5 이메일 생성 완료

```typescript
createEmailGeneratedEvent(workspaceId, jobId, lead, email, allLeads, allEmails, totalEmails)
// progressPercent: 55 + (allEmails.length / totalEmails) * 40 (최대 95%)
// messageKr: "{companyName} 이메일 완료 ✓"
// details.emails: 최근 10개 이메일
```

---

## 6. 진행률 구간 요약

| Phase | 시작% | 종료% | 계산 방식 |
|-------|-------|-------|----------|
| init | 0 | 5 | 고정 |
| discovery (start) | 5 | 10 | 고정 |
| discovery (batch) | 0 | 100 | `leadsFound / 30 * 100` |
| discovery (complete) | 30 | 30 | 고정 |
| group | 35 | 40 | 고정 |
| templates | 45 | 65 | `45 + (current/total) * 20` |
| sequence | 70 | 75 | 고정 |
| previews | 78 | 95 | `78 + (generated/total) * 17` |
| complete | 100 | 100 | 고정 |

---

## 7. 백엔드 SSE 엔드포인트

### 경로

```
GET /api/v1/onboarding/workspace/:workspaceId/stream
```

### 응답 형식

```
event: connected
data: {"type":"connected","message":"SSE connection established","workspaceId":"..."}

event: progress
data: {"phase":"discovery","progressPercent":25,"messageKr":"15명 찾았어요",...}

event: complete
data: {"phase":"complete","progressPercent":100,"final":true,...}

event: error
data: {"phase":"error","progressPercent":-1,"messageKr":"잠깐 문제가 생겼어요",...}
```

### Heartbeat

```
15초마다: `: heartbeat\n\n`
```

---

## 8. 프론트엔드 훅

### 파일 위치

```
admin/src/lib/api/hooks/onboarding.ts
```

### useOnboardingSSE

```typescript
function useOnboardingSSE(
  workspaceId: string,
  options?: {
    enabled?: boolean
    onProgress?: (event: OnboardingProgressEvent) => void
    onComplete?: (event: OnboardingProgressEvent) => void
    onError?: (event: OnboardingProgressEvent) => void
  }
): {
  isConnected: boolean
  progress: OnboardingProgressEvent | null
  phase: OnboardingPhase | null
  progressPercent: number
  message: string                // messageKr 우선 사용
  isComplete: boolean
  hasError: boolean
  connect: () => void
  disconnect: () => void
}
```

### useOnboardingWithSSE (통합 훅)

```typescript
function useOnboardingWithSSE(
  workspaceId: string,
  options?: {
    enableSSE?: boolean        // 기본값: true
    enablePolling?: boolean    // 기본값: false
    pollingInterval?: number   // 기본값: 5000ms
  }
)
```

### SSE 이벤트 처리 흐름

```typescript
// 1. SSE 스트림에서 줄 단위로 읽음
// 2. "event: " 라인 → 이벤트 타입 설정
// 3. "data: " 라인 → 데이터 설정
// 4. 빈 줄 → 이벤트 완성
//    - JSON 파싱
//    - 이벤트 타입별 처리:
//      * "connected": 로그만 출력
//      * "progress": progress 상태 업데이트 + onProgress 콜백
//      * "complete": isComplete=true + onComplete 콜백
//      * "error": hasError=true + toast.error 표시
```

---

## 9. 발행 함수 (Worker → Redis)

### emitOnboardingProgress

```typescript
// 파일: elysia-server/src/lib/redis/onboarding-events.ts

async function emitOnboardingProgress(event: OnboardingProgressEvent): Promise<void> {
  const channel = getOnboardingChannel(event.workspaceId)
  const publisher = getPublisher()
  await publisher.publish(channel, JSON.stringify(event))
}
```

### 사용 예시 (Worker에서)

```typescript
// Discovery 시작
await emitOnboardingProgress(createDiscoveryStartEvent(workspaceId, jobId))

// 리드 발견 시
await emitOnboardingProgress(createLeadDiscoveredEvent(
  workspaceId, jobId, lead, allLeads, 30
))

// 완료
await emitOnboardingProgress(createCompleteEvent(workspaceId, jobId, leadsCount))
```

---

## 10. 구독 함수 (API Server)

### createOnboardingSubscriber

```typescript
function createOnboardingSubscriber(workspaceId: string): OnboardingSubscriber {
  return {
    subscribe: (callback: (event: OnboardingProgressEvent) => void) => {
      // Redis 채널 구독
      // 메시지 수신 시 callback 호출
    },
    unsubscribe: async () => {
      // 구독 해제 및 연결 종료
    }
  }
}
```

---

## 11. 상수값

```typescript
// elysia-server/src/lib/redis/onboarding-events.ts
const TARGET_LEADS_FOR_PROGRESS = 30

// elysia-server/src/services/onboarding-worker.service.ts
const TARGET_LEADS = 30

// elysia-server/src/services/lead-search-enrichment.service.ts
SEARCH_CONFIG.TARGET_LEADS = 30
```

---

## 12. 에러 처리

### 백엔드

```typescript
// emitOnboardingProgress 실패 시
catch (error) {
  logger.warn({ error, event }, "[OnboardingEvents] Failed to emit progress")
  // 예외 발생 안 함 - 진행 영향 없음
}
```

### 프론트엔드

```typescript
// SSE 파싱 실패
catch (parseError) {
  console.warn("[Onboarding SSE] Failed to parse event:", currentData)
  // 계속 진행
}

// 네트워크 에러
catch (error) {
  if (error.name !== "AbortError") {
    setHasError(true)
  }
}

// 에러 이벤트 수신
if (currentEventType === "error") {
  toast.error(eventData.messageKr || eventData.message || "오류가 발생했습니다")
}
```

---

## 13. 메시지 다국어

프론트엔드에서 항상 한글 메시지 우선:

```typescript
message: progress?.messageKr || progress?.message || ""
```

---

## 14. 파일 경로 요약

### 백엔드

| 파일 | 역할 |
|------|------|
| `elysia-server/src/lib/redis/onboarding-events.ts` | 이벤트 타입, 발행/구독, 메시지 헬퍼 |
| `elysia-server/src/routes/onboarding.routes.ts:85` | SSE 엔드포인트 `/stream` |
| `elysia-server/src/services/onboarding-worker.service.ts` | emit 호출 위치 |

### 프론트엔드

| 파일 | 역할 |
|------|------|
| `admin/src/lib/api/hooks/onboarding.ts` | `useOnboardingSSE`, `useOnboardingWithSSE` |
| `admin/src/lib/api/services/onboarding.ts` | REST API 클라이언트 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-06 | 초기 문서 작성, TARGET_LEADS 30개로 변경 반영 |
