# BullMQ 시퀀스 이메일 워커 - 기술 상세 명세서

> 작성일: 2025-01-02
> 버전: 2.0
> 상태: 구현 완료, 배포 대기

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [기술 아키텍처](#2-기술-아키텍처)
3. [변경된 파일 상세](#3-변경된-파일-상세)
4. [Redis-PostgreSQL 동기화](#4-redis-postgresql-동기화)
5. [시나리오별 데이터 흐름](#5-시나리오별-데이터-흐름)
6. [에러 처리 및 복구](#6-에러-처리-및-복구)
7. [모니터링 및 로깅](#7-모니터링-및-로깅)
8. [마이그레이션 요구사항](#8-마이그레이션-요구사항)
9. [배포 체크리스트](#9-배포-체크리스트)
10. [롤백 계획](#10-롤백-계획)

---

## 1. Executive Summary

### 1.1 변경 배경
60초 폴링 기반 이메일 시퀀스 워커(`email-sequence-worker-v2.ts`)를 BullMQ 이벤트 기반 워커로 전면 교체

### 1.2 주요 개선점

| 항목 | Before (60초 폴링) | After (BullMQ) |
|------|-------------------|----------------|
| **처리 방식** | 60초 간격 DB 폴링 | 이벤트 기반 즉시 처리 |
| **지연 시간** | 최대 60초 | 밀리초 단위 정확도 |
| **DB 부하** | 매분 전체 테이블 스캔 | 필요 시에만 조회 |
| **시퀀스 상태 체크** | ❌ 없음 | ✅ active만 발송 |
| **등록 상태 체크** | ❌ 없음 | ✅ active만 발송 |
| **리드 상태 체크** | ❌ 없음 | ✅ unsubscribed 스킵 |
| **재시도** | ❌ 없음 | ✅ 3회 + exponential backoff |
| **스톨 감지** | 수동 복구 | ✅ 자동 감지 및 복구 |
| **중복 처리 방지** | FOR UPDATE SKIP LOCKED | jobId 기반 deduplication |
| **작업 로깅** | ❌ 없음 | ✅ PostgreSQL job_logs 테이블 |

### 1.3 영향 범위

- **영향받는 워크스페이스**: 9개
- **영향받는 시퀀스**: 15개 (active 5개, paused 10개)
- **총 Pending 이메일**: 3,757건
- **Active 시퀀스 Pending**: 785건 (실제 발송 대상)

---

## 2. 기술 아키텍처

### 2.1 시스템 구조도

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Server (Elysia)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────────┐ │
│  │ sequences.routes.ts     │    │ sequence.service.ts                      │ │
│  │                         │    │                                          │ │
│  │ POST /enroll            │───►│ bulkEnrollWithScheduling()               │ │
│  │ PUT  /:id (pause)       │    │   1. INSERT sequence_enrollments         │ │
│  │ PUT  /:id (resume)      │    │   2. INSERT sequence_step_executions     │ │
│  │ DELETE /:id             │    │   3. addSequenceEmailJobs() ──────────┐  │ │
│  │ PATCH enrollment/status │    │                                       │  │ │
│  └─────────────────────────┘    └───────────────────────────────────────│──┘ │
│                                                                          │    │
│  ┌─────────────────────────┐    ┌───────────────────────────────────────│──┐ │
│  │ leads.routes.ts         │    │ queues.ts                             │  │ │
│  │                         │    │                                       ▼  │ │
│  │ PUT  /:id (unsubscribe) │───►│ cancelLeadJobs()                         │ │
│  │ PUT  /bulk/status       │    │ cancelSequenceJobs()                     │ │
│  └─────────────────────────┘    │ cancelEnrollmentJobs()                   │ │
│                                 │ cancelExecutionJob()                      │ │
│                                 │ enqueueExistingPendingExecutions()        │ │
│                                 │ migratePendingExecutionsToBullMQ()        │ │
│                                 └──────────────────────────────────────────┘ │
│                                                    │                         │
└────────────────────────────────────────────────────│─────────────────────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                Redis                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ bull:sequence-email:*                                                 │   │
│  │                                                                       │   │
│  │  Job: seq-email-{executionId}                                         │   │
│  │  Data: { executionId, enrollmentId, stepId, leadId, ... }             │   │
│  │  Opts: { delay: ms, jobId: 'seq-email-{id}' }                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BullMQ Worker (worker.ts)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ sequence-email.worker.ts                                              │   │
│  │                                                                       │   │
│  │  1. Job 수신                                                          │   │
│  │  2. 시퀀스 상태 체크 (sequences.status === 'active')                   │   │
│  │     └─ paused/deleted → 스킵 + step_execution.status = 'skipped'      │   │
│  │  3. 등록 상태 체크 (enrollments.status === 'active')                   │   │
│  │     └─ stopped/paused → 스킵 + step_execution.status = 'skipped'      │   │
│  │  4. 리드 상태 체크 (leads.lead_status !== 'unsubscribed')              │   │
│  │     └─ unsubscribed → 스킵 + step_execution.status = 'skipped'        │   │
│  │  5. 이메일 검증 (Hunter.io)                                            │   │
│  │     └─ invalid → 대체 이메일 찾기 또는 실패                            │   │
│  │  6. 이메일 발송 (SendGrid/Nylas)                                       │   │
│  │  7. step_execution.status = 'sent' 업데이트                            │   │
│  │  8. job_logs 테이블에 결과 기록                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Worker Options:                                                             │
│  - concurrency: 5                                                            │
│  - stalledInterval: 30000ms                                                  │
│  - lockDuration: 60000ms                                                     │
│  - maxStalledCount: 2                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL                                      │
│  ┌───────────────────┬─────────────────────┬─────────────────────────────┐  │
│  │ sequences         │ sequence_enrollments │ sequence_step_executions    │  │
│  │ - id              │ - id                 │ - id                        │  │
│  │ - status          │ - status             │ - status                    │  │
│  │ - workspace_id    │ - lead_id            │ - enrollment_id             │  │
│  └───────────────────┴─────────────────────┴─────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ job_logs                                                               │  │
│  │ - job_id (seq-email-{executionId})                                     │  │
│  │ - queue_name                                                           │  │
│  │ - status (waiting/delayed/active/completed/failed)                     │  │
│  │ - input_data, output_data, error_message                               │  │
│  │ - started_at, completed_at, failed_at, duration_ms                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름

```
[리드 등록 시]
API Request → DB Insert (enrollments, executions) → Redis Job Add (with delay)
                           ↑                              ↓
                    Source of Truth              Scheduled Processing

[Job 처리 시]
Redis Job Ready → Worker Fetch → DB State Validation → Email Send → DB Update
                                         ↓
                                  (상태 불일치 시 스킵)

[상태 변경 시]
API Request → DB Update → Redis Job Cancel/Re-enqueue (best-effort)
                 ↑                    ↓
          Source of Truth     Sync Attempt (non-blocking)
```

---

## 3. 변경된 파일 상세

### 3.1 `src/index.ts`

**변경 내용**: 60초 폴링 워커 제거

```typescript
// BEFORE
import { startEmailSequenceWorker } from "./workers/email-sequence-worker-v2"
if (!isDevelopment) {
  startEmailSequenceWorker()  // 60초 폴링 시작
  startWorkflowExecutionWorker()
  startScheduledEmailWorker()
}

// AFTER
// NOTE: 60-second email sequence worker removed - replaced by BullMQ worker
// import { startEmailSequenceWorker } from "./workers/email-sequence-worker-v2"
if (!isDevelopment) {
  // Email sequence emails are now processed by BullMQ worker (SequenceEmailWorker)
  startWorkflowExecutionWorker()
  startScheduledEmailWorker()
  logger.info("[Worker] workflow, scheduled-email started (sequence emails handled by BullMQ)")
}
```

### 3.2 `src/services/sequence.service.ts`

**변경 내용**: 리드 등록 시 BullMQ Job 생성 추가

```typescript
// 추가된 import
import { addSequenceEmailJobs } from "../lib/queue/queues"
import type { SequenceEmailJob } from "../lib/queue/types"

// bulkEnrollWithScheduling() 함수 내
export async function bulkEnrollWithScheduling(data: BulkEnrollInput) {
  // 1. 시퀀스 정보 조회 (신규)
  const [sequenceInfo] = await db
    .select({ name, workspaceId, createdBy })
    .from(sequences)
    .where(eq(sequences.id, data.sequenceId))

  // 2. 리드 정보 조회 (companyName 추가)
  const leadsWithEmails = await db.select({
    leadId: leads.id,
    email: leadContacts.contactValue,
    companyName: leads.companyName,  // 신규 추가
  }).from(leads).innerJoin(...)

  // 3. DB Insert 후 execution ID 반환받기 (변경)
  const insertedExecutions = await db
    .insert(sequenceStepExecutions)
    .values(stepExecutionValues)
    .returning({ id: sequenceStepExecutions.id })  // 신규: ID 반환

  // 4. BullMQ Jobs 생성 (신규)
  const bullmqJobs = insertedExecutions.map((exec, i) => ({
    data: {
      executionId: exec.id,
      enrollmentId: stepExecutionValues[i].enrollmentId,
      stepId: stepExecutionValues[i].stepId,
      stepOrder: stepExecutionValues[i].stepOrder,
      leadId: extraData[i].leadId,
      leadCompanyName: extraData[i].leadCompanyName,
      emailAccountId: data.userEmailAccountId,
      emailSubject: extraData[i].step.emailSubject,
      emailBodyText: extraData[i].step.emailBodyText,
      emailBodyHtml: extraData[i].step.emailBodyHtml,
      sequenceName: sequenceInfo.name,
      sequenceId: data.sequenceId,
      workspaceId: sequenceInfo.workspaceId,
      userId: data.enrolledBy || sequenceInfo.createdBy,
      attachments: extraData[i].step.attachments,
    },
    opts: {
      delay: Math.max(0, extraData[i].scheduledAt.getTime() - now),
      jobId: `seq-email-${exec.id}`,
    },
  }))

  // 5. BullMQ 일괄 등록 (신규)
  if (bullmqJobs.length > 0) {
    try {
      await addSequenceEmailJobs(bullmqJobs)
      logger.info({ jobsCreated: bullmqJobs.length }, "✅ Created BullMQ jobs")
    } catch (error) {
      // 보상 로직: DB는 정상, Redis 실패 시 나중에 마이그레이션으로 복구
      logger.error({ error }, "❌ Failed to create BullMQ jobs - use migration to recover")
    }
  }
}
```

### 3.3 `src/lib/queue/queues.ts`

**추가된 함수들**:

| 함수 | 용도 | 호출 시점 |
|------|------|----------|
| `addSequenceEmailJob()` | 단일 Job 추가 | 개별 등록 |
| `addSequenceEmailJobs()` | 대량 Job 추가 | 벌크 등록 |
| `cancelSequenceJobs()` | 시퀀스 전체 Job 취소 | 시퀀스 pause/delete |
| `cancelEnrollmentJobs()` | 등록 전체 Job 취소 | 등록 stop |
| `cancelLeadJobs()` | 리드 전체 Job 취소 | 리드 unsubscribe |
| `cancelExecutionJob()` | 단일 Job 취소 | 개별 취소 |
| `enqueueExistingPendingExecutions()` | Pending execution 재등록 | 시퀀스 resume |
| `migratePendingExecutionsToBullMQ()` | 기존 데이터 마이그레이션 | 초기 배포 시 |
| `getSequenceJobsStatus()` | 시퀀스 Job 상태 조회 | 모니터링 |
| `getSequenceEmailQueueStatus()` | 큐 전체 상태 조회 | 헬스체크 |

### 3.4 `src/routes/sequences.routes.ts`

**추가된 동기화 로직**:

```typescript
// 시퀀스 일시정지 시
if (body.status === "paused" && currentSequence.status !== "paused") {
  try {
    const result = await cancelSequenceJobs(id)
    logger.info({ sequenceId: id, ...result }, "✅ [Sync] Canceled BullMQ jobs on pause")
  } catch (error) {
    logger.warn({ error }, "⚠️ [Sync] Failed to cancel BullMQ jobs, continuing...")
  }
}

// 시퀀스 재개 시
if (body.status === "active" && currentSequence.status === "paused") {
  try {
    const result = await enqueueExistingPendingExecutions(id)
    logger.info({ sequenceId: id, ...result }, "✅ [Sync] Re-enqueued pending executions on resume")
  } catch (error) {
    logger.warn({ error }, "⚠️ [Sync] Failed to re-enqueue, continuing...")
  }
}

// 시퀀스 삭제 전
try {
  const result = await cancelSequenceJobs(id)
  logger.info({ sequenceId: id, ...result }, "✅ [Sync] Canceled BullMQ jobs before deletion")
} catch (error) {
  logger.warn({ error }, "⚠️ [Sync] Failed to cancel BullMQ jobs, continuing with deletion")
}

// 등록 상태 변경 시
if (body.status === "stopped" || body.status === "paused" || body.status === "unsubscribed") {
  try {
    const result = await cancelEnrollmentJobs(enrollmentId)
    logger.info({ enrollmentId, ...result }, "✅ [Sync] Canceled BullMQ jobs on enrollment change")
  } catch (error) {
    logger.warn({ error }, "⚠️ [Sync] Failed to cancel BullMQ jobs, continuing...")
  }
}
```

### 3.5 `src/routes/leads.routes.ts`

**추가된 동기화 로직**:

```typescript
// 리드 구독취소 시
if (body.leadStatus === "unsubscribed") {
  try {
    const result = await cancelLeadJobs(id)
    logger.info({ leadId: id, ...result }, "✅ [Sync] Canceled BullMQ jobs on unsubscribe")
  } catch (error) {
    logger.warn({ error }, "⚠️ [Sync] Failed to cancel BullMQ jobs, continuing...")
  }
}

// 벌크 구독취소 시
if (body.leadStatus === "unsubscribed") {
  try {
    const results = await Promise.allSettled(body.leadIds.map(id => cancelLeadJobs(id)))
    const successCount = results.filter(r => r.status === "fulfilled").length
    logger.info({ leadCount: body.leadIds.length, successCount }, "✅ [Sync] Bulk canceled jobs")
  } catch (error) {
    logger.warn({ error }, "⚠️ [Sync] Failed to bulk cancel, continuing...")
  }
}
```

---

## 4. Redis-PostgreSQL 동기화

### 4.1 동기화 원칙

```
┌─────────────────────────────────────────────────────────────────────┐
│                         동기화 원칙                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. PostgreSQL = Source of Truth (진실의 원천)                       │
│     - 모든 상태 변경은 DB 먼저 수행                                   │
│     - DB 변경 성공 후 Redis 동기화 시도                               │
│                                                                      │
│  2. Redis = Best-Effort Sync (최선 노력 동기화)                       │
│     - Redis 동기화 실패해도 API 성공 반환                             │
│     - Worker가 처리 전 DB 상태 재확인                                 │
│     - 실패 시 Warning 로그 (Error 아님)                               │
│                                                                      │
│  3. Worker = Safety Net (안전망)                                     │
│     - Job 처리 전 항상 DB 상태 검증                                   │
│     - 불일치 시 스킵 (잘못된 이메일 발송 방지)                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 동기화 시점

| 이벤트 | DB 작업 | Redis 작업 | 실패 시 처리 |
|--------|---------|-----------|-------------|
| 리드 등록 | INSERT enrollments, executions | ADD Jobs with delay | DB 기록 유지, 마이그레이션으로 복구 |
| 시퀀스 pause | UPDATE status='paused' | CANCEL waiting/delayed Jobs | Worker에서 스킵 |
| 시퀀스 resume | UPDATE status='active' | RE-ENQUEUE pending executions | Worker에서 자동 처리 |
| 시퀀스 delete | DELETE sequence | CANCEL all Jobs | Orphan Job은 Worker에서 스킵 |
| 등록 stop | UPDATE status='stopped' | CANCEL enrollment Jobs | Worker에서 스킵 |
| 리드 unsubscribe | UPDATE lead_status='unsubscribed' | CANCEL lead Jobs | Worker에서 스킵 |

### 4.3 불일치 시나리오 및 복구

```
시나리오 1: Redis Job 존재, DB에서 시퀀스 paused
───────────────────────────────────────────────
  Worker Job 처리 시:
    → sequences.status 체크
    → "paused" 감지
    → step_execution.status = 'skipped' 업데이트
    → Job 완료 (이메일 발송 안함)

시나리오 2: Redis Job 없음, DB에 pending execution 존재
───────────────────────────────────────────────────────
  해결 방법:
    → migratePendingExecutionsToBullMQ() 호출
    → 모든 pending execution에 대해 Job 생성
    → 자동 복구 완료

시나리오 3: Redis Job 존재, DB에서 execution 이미 sent/failed
────────────────────────────────────────────────────────────
  Worker Job 처리 시:
    → step_execution.status 체크
    → "pending" 아님 감지
    → Job 스킵 (중복 처리 방지)
```

---

## 5. 시나리오별 데이터 흐름

### 5.1 정상 시나리오: 새 캠페인 등록 → 이메일 발송

```
[T+0ms]  API: POST /sequences/:id/enroll
         │
[T+10ms] sequence.service.ts:
         ├─ INSERT sequence_enrollments (status: 'active')
         ├─ INSERT sequence_step_executions (status: 'pending', scheduledAt: T+3days)
         └─ Redis: ADD Job (delay: 259200000ms, jobId: 'seq-email-{execId}')
         │
[T+3days] BullMQ Worker:
         ├─ Job 수신
         ├─ DB 조회: sequences.status = 'active' ✓
         ├─ DB 조회: enrollments.status = 'active' ✓
         ├─ DB 조회: leads.lead_status = 'qualified' ✓ (not unsubscribed)
         ├─ Hunter.io: 이메일 검증 ✓
         ├─ SendGrid: 이메일 발송 ✓
         ├─ DB 업데이트: step_executions.status = 'sent'
         └─ DB 삽입: job_logs (status: 'completed')
```

### 5.2 시퀀스 일시정지 후 재개

```
[Phase 1: 일시정지]
──────────────────
[T+0ms]  API: PUT /sequences/:id { status: 'paused' }
         │
[T+10ms] sequences.routes.ts:
         ├─ DB: UPDATE sequences SET status = 'paused'
         └─ Redis: cancelSequenceJobs(id)
              ├─ Job1: waiting → removed
              ├─ Job2: delayed → removed
              └─ Job3: active → (완료까지 대기)
         │
[T+20ms] 결과:
         ├─ Redis: 대기 중 Job 제거됨
         └─ DB: step_executions는 여전히 'pending' (변경 없음)

[Phase 2: 재개]
──────────────────
[T+1hour] API: PUT /sequences/:id { status: 'active' }
         │
[T+1hour+10ms] sequences.routes.ts:
         ├─ DB: UPDATE sequences SET status = 'active'
         └─ Redis: enqueueExistingPendingExecutions(id)
              ├─ DB 조회: pending executions
              └─ 각 execution에 대해 Job 생성 (delay=0 또는 남은 시간)
         │
[T+1hour+50ms] BullMQ Worker:
         └─ 정상 처리 시작
```

### 5.3 리드 구독취소 (법적 컴플라이언스)

```
[T+0ms]  API: PUT /leads/:id { leadStatus: 'unsubscribed' }
         │
[T+5ms]  leads.routes.ts:
         ├─ DB: UPDATE leads SET lead_status = 'unsubscribed'
         └─ Redis: cancelLeadJobs(id)
              ├─ Job1 (step1): delayed → removed
              ├─ Job2 (step2): delayed → removed
              └─ Job3 (step3): delayed → removed
         │
[T+10ms] job_logs 업데이트:
         └─ status = 'failed', errorMessage = 'Job canceled: Lead unsubscribed'

[이후] 동일 리드로 이미 active 중인 Job이 있는 경우:
         │
         └─ Worker 처리 시:
              ├─ DB 조회: leads.lead_status = 'unsubscribed'
              └─ 스킵 처리 (이메일 발송 안함)
```

---

## 6. 에러 처리 및 복구

### 6.1 에러 유형별 처리

| 에러 유형 | 재시도 | 처리 방법 |
|----------|--------|----------|
| Redis 연결 실패 | ✅ 3회 | exponential backoff (30s, 60s, 120s) |
| SendGrid API 에러 | ✅ 3회 | exponential backoff |
| Hunter.io 검증 실패 | ❌ | 대체 이메일 찾기 시도 → 없으면 failed |
| DB 조회 에러 | ✅ 3회 | exponential backoff |
| 시퀀스 상태 불일치 | ❌ | 즉시 스킵 (skipped) |

### 6.2 보상 로직 (Compensation)

```typescript
// BullMQ Job 생성 실패 시 보상 로직
try {
  await addSequenceEmailJobs(bullmqJobs)
} catch (bullmqError) {
  // DB는 이미 정상 기록됨
  // Redis 실패는 Warning 처리
  // 나중에 migratePendingExecutionsToBullMQ()로 복구 가능
  logger.warn({ error: bullmqError }, "BullMQ job creation failed - will recover via migration")
}
```

### 6.3 스톨(Stall) 감지 및 복구

```
Worker 설정:
- stalledInterval: 30000ms (30초마다 스톨 체크)
- lockDuration: 60000ms (Job 락 유지 시간)
- maxStalledCount: 2 (2회 스톨 시 실패 처리)

스톨 시나리오:
1. Worker가 Job 처리 중 크래시
2. 30초 후 다른 Worker가 스톨 감지
3. Job 자동 재시도 (attempt 증가)
4. 2회 이상 스톨 시 failed 처리
```

---

## 7. 모니터링 및 로깅

### 7.1 로그 커버리지

| 이벤트 | 로그 레벨 | 로그 내용 |
|--------|----------|----------|
| Job 생성 | INFO | `"✅ Created BullMQ jobs"` + jobCount |
| Job 취소 | INFO | `"✅ [Sync] Canceled BullMQ jobs"` + canceled/failed/active counts |
| Job 재등록 | INFO | `"✅ [Sync] Re-enqueued pending executions"` + counts |
| 동기화 실패 | WARN | `"⚠️ [Sync] Failed to..."` + error |
| 상태 불일치 스킵 | INFO | `"Skipping: sequence status is paused"` |
| 이메일 발송 성공 | INFO | `"Email sent successfully"` + messageId |
| 이메일 발송 실패 | ERROR | `"Failed to send email"` + error |

### 7.2 Health Endpoints

```bash
# Worker Health
curl http://localhost:3010/health
{
  "status": "healthy",
  "redis": { "connected": true, "ping": "1ms" },
  "workers": {
    "sequence-email": { "running": true, "concurrency": 5 }
  },
  "queues": {
    "sequence-email": { "waiting": 10, "delayed": 500, "active": 2 }
  }
}

# Queue Metrics
curl http://localhost:3010/metrics
{
  "sequence-email": {
    "waiting": 10,
    "delayed": 500,
    "active": 2,
    "completed": 1500,
    "failed": 5
  }
}
```

### 7.3 job_logs 쿼리 예시

```sql
-- 최근 24시간 시퀀스 이메일 통계
SELECT
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM job_logs
WHERE queue_name = 'sequence-email'
  AND added_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- 실패한 Job 상세
SELECT
  job_id,
  input_data->>'sequenceName' as sequence_name,
  input_data->>'leadCompanyName' as company,
  error_message,
  failed_at
FROM job_logs
WHERE queue_name = 'sequence-email'
  AND status = 'failed'
  AND added_at > NOW() - INTERVAL '24 hours'
ORDER BY failed_at DESC
LIMIT 20;
```

---

## 8. 마이그레이션 요구사항

### 8.1 DB 스키마 변경

**변경 없음** - 기존 스키마 100% 호환

| 테이블 | 변경 | 비고 |
|--------|------|------|
| sequences | 없음 | status 컬럼 기존 활용 |
| sequence_enrollments | 없음 | status 컬럼 기존 활용 |
| sequence_step_executions | 없음 | status 컬럼 기존 활용 |
| job_logs | 없음 | 이미 존재 |
| leads | 없음 | lead_status 컬럼 기존 활용 |

### 8.2 Redis 마이그레이션

**신규 키 패턴 생성**:
```
bull:sequence-email:*  (신규)
```

**기존 키 영향 없음**:
```
bull:test-queue:*
bull:onboarding-generation:*
rate-limit:*
```

### 8.3 기존 Pending Execution 마이그레이션

```typescript
// 배포 후 1회 실행 필요
import { migratePendingExecutionsToBullMQ } from "./lib/queue/queues"

const result = await migratePendingExecutionsToBullMQ()
console.log(result)
// { migrated: 785, skipped: 0, failed: 0 }
```

**현재 마이그레이션 대상 분석**:

| 시퀀스 상태 | 등록 상태 | Pending 건수 | 마이그레이션 후 동작 |
|------------|----------|-------------|-------------------|
| active | active | 785건 | BullMQ에서 정상 발송 |
| paused | active | 2,868건 | BullMQ에서 스킵 (시퀀스 paused) |
| paused | completed | 3건 | BullMQ에서 스킵 (등록 completed) |
| paused | stopped | 2건 | BullMQ에서 스킵 (등록 stopped) |

---

## 9. 배포 체크리스트

### 9.1 배포 전 (Pre-deployment)

- [ ] 로컬 빌드 성공: `bun run build`
- [ ] 타입 체크 통과: `bun run typecheck`
- [ ] 린트 체크 통과: `bun run lint`
- [ ] BullMQ Worker 컨테이너 설정 확인 (docker-compose.yml)
- [ ] Redis 연결 설정 확인 (.env)

### 9.2 배포 중 (Deployment)

```bash
# 1. 코드 푸시 (CI/CD 자동 배포)
git push origin main

# 2. 배포 완료 대기 (약 2-3분)
ssh send "docker ps -a | grep elysia"
```

### 9.3 배포 후 (Post-deployment)

```bash
# 1. 컨테이너 상태 확인
ssh send "docker ps -a | grep -E 'elysia|bullmq'"

# 2. BullMQ Worker 로그 확인
ssh send "docker logs send-grid-test-bullmq-worker-1 --tail 50"
# 확인: "SequenceEmailWorker registered"

# 3. 60초 워커 미실행 확인
ssh send "docker logs send-grid-test-elysia-server-1 2>&1 | grep 'STEP-WORKER-V2'"
# 결과: 없어야 함

# 4. Health check
curl https://api.grinda.ai:3010/health

# 5. 기존 Pending 마이그레이션 (1회)
# API 또는 직접 호출로 migratePendingExecutionsToBullMQ() 실행
```

---

## 10. 롤백 계획

### 10.1 롤백 트리거

- BullMQ Worker 지속적 실패 (5분 이상)
- Redis 연결 불안정
- 예상치 못한 대량 이메일 발송
- 심각한 성능 저하

### 10.2 롤백 절차

```bash
# Step 1: Git Revert
git revert <commit-hash>
git push origin main

# Step 2: 배포 대기 (자동)

# Step 3: 확인
ssh send "docker logs send-grid-test-elysia-server-1 --tail 20 | grep 'STEP-WORKER-V2'"
# 결과: "[STEP-WORKER-V2] Started..." 표시되어야 함
```

### 10.3 롤백 후 데이터 복구

```sql
-- BullMQ에서 'skipped'된 execution을 'pending'으로 복구
UPDATE sequence_step_executions
SET status = 'pending', error_message = NULL
WHERE status = 'skipped'
  AND error_message LIKE 'Sequence status:%'
  AND updated_at > '2025-01-02';
```

---

*문서 끝*
