# BullMQ 시퀀스 이메일 워커 마이그레이션 상세 문서

> 작성일: 2025-01-02
> 버전: 1.0
> 상태: 구현 완료, 배포 대기

---

## 목차

1. [개요](#1-개요)
2. [수정된 파일 목록](#2-수정된-파일-목록)
3. [상세 변경 사항](#3-상세-변경-사항)
4. [아키텍처 변경](#4-아키텍처-변경)
5. [시나리오별 동작 프로세스](#5-시나리오별-동작-프로세스)
6. [데이터 호환성](#6-데이터-호환성)
7. [모니터링](#7-모니터링)
8. [배포 가이드](#8-배포-가이드)
9. [롤백 계획](#9-롤백-계획)

---

## 1. 개요

### 1.1 배경
- 기존 60초 폴링 워커(`email-sequence-worker-v2.ts`)에서 BullMQ 이벤트 기반 워커로 전환
- 폴링 방식의 DB 부하 및 지연 시간 문제 해결
- 안전 체크 강화 (시퀀스/등록/리드 상태 검증)

### 1.2 주요 개선점

| 항목 | 60초 워커 (Before) | BullMQ 워커 (After) |
|------|-------------------|---------------------|
| 처리 방식 | 60초 폴링 | 이벤트 기반 즉시 처리 |
| 시퀀스 상태 체크 | ❌ 없음 | ✅ active만 발송 |
| 등록 상태 체크 | ❌ 없음 | ✅ active만 발송 |
| 리드 상태 체크 | ❌ 없음 | ✅ unsubscribed 스킵 |
| 중복 처리 방지 | FOR UPDATE SKIP LOCKED | jobId 기반 deduplication |
| 재시도 | ❌ 없음 | ✅ 자동 3회 + exponential backoff |
| 스톨 감지 | 수동 복구 | ✅ 자동 감지 및 복구 |
| Job 로깅 | ❌ 없음 | ✅ PostgreSQL job_logs 테이블 |

---

## 2. 수정된 파일 목록

### 2.1 신규 생성
```
(없음 - 기존 파일만 수정)
```

### 2.2 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/index.ts` | 60초 워커 import/실행 제거 |
| `src/services/sequence.service.ts` | `bulkEnrollWithScheduling()`에 BullMQ Job 생성 추가 |
| `src/lib/queue/queues.ts` | `migratePendingExecutionsToBullMQ()` 함수 추가 |
| `src/lib/queue/types.ts` | `generationSource` 타입에 "template" 추가 |
| `src/worker.ts` | SequenceEmailWorker 이미 등록됨 (확인) |
| `src/workers/bullmq/sequence-email.worker.ts` | 상태 체크 로직 포함 (기존) |

---

## 3. 상세 변경 사항

### 3.1 `src/index.ts` 변경

**Before:**
```typescript
import { startEmailSequenceWorker } from "./workers/email-sequence-worker-v2"

if (!isDevelopment) {
  startEmailSequenceWorker()
  startWorkflowExecutionWorker()
  startScheduledEmailWorker()
  logger.info("[Worker] sequence, workflow, scheduled-email started")
}
```

**After:**
```typescript
// NOTE: 60-second email sequence worker removed - replaced by BullMQ worker
// import { startEmailSequenceWorker } from "./workers/email-sequence-worker-v2"

if (!isDevelopment) {
  // Email sequence emails are now processed by BullMQ worker (SequenceEmailWorker)
  // See: src/workers/bullmq/sequence-email.worker.ts
  startWorkflowExecutionWorker()
  startScheduledEmailWorker()
  logger.info("[Worker] workflow, scheduled-email started (sequence emails handled by BullMQ)")
}
```

### 3.2 `src/services/sequence.service.ts` 변경

**추가된 import:**
```typescript
import { addSequenceEmailJobs } from "../lib/queue/queues"
import type { SequenceEmailJob } from "../lib/queue/types"
```

**추가된 시퀀스 정보 조회:**
```typescript
// bulkEnrollWithScheduling() 함수 내부
const [sequenceInfo] = await db
  .select({
    name: sequences.name,
    workspaceId: sequences.workspaceId,
    createdBy: sequences.createdBy,
  })
  .from(sequences)
  .where(eq(sequences.id, data.sequenceId))
  .limit(1)
```

**추가된 companyName 조회:**
```typescript
const leadsWithEmails = await db
  .select({
    leadId: leads.id,
    email: leadContacts.contactValue,
    companyName: leads.companyName,  // 추가됨
  })
  .from(leads)
  // ...
```

**추가된 BullMQ Job 생성 로직:**
```typescript
// Step execution insert 후 반환된 ID 사용
const insertedExecutions = await db
  .insert(sequenceStepExecutions)
  .values(stepExecutionValues)
  .returning({ id: sequenceStepExecutions.id })

// BullMQ Job 생성
const bullmqJobs: Array<{ data: SequenceEmailJob; opts: { delay: number; jobId: string } }> = []
const now = Date.now()

for (let i = 0; i < insertedExecutions.length; i++) {
  const execution = insertedExecutions[i]
  const stepExecValue = stepExecutionValues[i]
  const extraData = bullmqJobData[i]

  if (!execution || !stepExecValue || !extraData) continue

  const delayMs = Math.max(0, extraData.scheduledAt.getTime() - now)

  bullmqJobs.push({
    data: {
      executionId: execution.id,
      enrollmentId: stepExecValue.enrollmentId,
      stepId: stepExecValue.stepId,
      stepOrder: stepExecValue.stepOrder,
      leadId: extraData.leadId,
      leadCompanyName: extraData.leadCompanyName,
      emailAccountId: data.userEmailAccountId,
      emailSubject: extraData.step.emailSubject || "",
      emailBodyText: extraData.step.emailBodyText,
      emailBodyHtml: extraData.step.emailBodyHtml,
      sequenceName: sequenceInfo.name,
      sequenceId: data.sequenceId,
      workspaceId: sequenceInfo.workspaceId,
      userId: data.enrolledBy || sequenceInfo.createdBy,
      attachments: extraData.step.attachments as
        | Array<{ filename: string; type: string; content: string }>
        | null,
    },
    opts: {
      delay: delayMs,
      jobId: `seq-email-${execution.id}`,  // 중복 방지 키
    },
  })
}

// BullMQ에 일괄 추가
if (bullmqJobs.length > 0) {
  await addSequenceEmailJobs(bullmqJobs)
}
```

### 3.3 `src/lib/queue/queues.ts` 변경

**추가된 마이그레이션 함수:**
```typescript
/**
 * 기존 pending execution을 BullMQ Job으로 마이그레이션
 * @param sequenceId - 특정 시퀀스만 마이그레이션 (선택적)
 */
export async function migratePendingExecutionsToBullMQ(sequenceId?: string): Promise<{
  migrated: number
  skipped: number
  failed: number
}> {
  // Lazy import to avoid circular dependencies
  const { db } = await import("../../db")
  const { and, eq, lte } = await import("drizzle-orm")
  const { sequenceStepExecutions, sequenceSteps, sequenceEnrollments, sequences } = await import(
    "../../db/schema/sequences"
  )
  const { leads } = await import("../../db/schema/leads")

  // 조건 설정
  const conditions = [
    eq(sequenceStepExecutions.status, "pending"),
    lte(sequenceStepExecutions.scheduledAt, new Date()),
  ]
  if (sequenceId) {
    conditions.push(eq(sequences.id, sequenceId))
  }

  // 모든 pending execution 조회 (관련 데이터 포함)
  const pendingExecutions = await db
    .select({
      executionId: sequenceStepExecutions.id,
      enrollmentId: sequenceStepExecutions.enrollmentId,
      stepId: sequenceStepExecutions.stepId,
      stepOrder: sequenceStepExecutions.stepOrder,
      scheduledAt: sequenceStepExecutions.scheduledAt,
      leadId: sequenceEnrollments.leadId,
      leadCompanyName: leads.companyName,
      emailAccountId: sequenceEnrollments.emailAccountId,
      emailSubject: sequenceSteps.emailSubject,
      emailBodyText: sequenceSteps.emailBodyText,
      emailBodyHtml: sequenceSteps.emailBodyHtml,
      sequenceId: sequences.id,
      sequenceName: sequences.name,
      workspaceId: sequences.workspaceId,
      userId: sequences.createdBy,
      attachments: sequenceSteps.attachments,
    })
    .from(sequenceStepExecutions)
    .innerJoin(sequenceSteps, eq(sequenceStepExecutions.stepId, sequenceSteps.id))
    .innerJoin(sequenceEnrollments, eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id))
    .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
    .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .where(and(...conditions))

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const exec of pendingExecutions) {
    try {
      // 기존 Job 확인
      const existingJob = await sequenceEmailQueue.getJob(`seq-email-${exec.executionId}`)
      if (existingJob) {
        const state = await existingJob.getState()
        if (state === "active" || state === "waiting" || state === "delayed") {
          skipped++
          continue
        }
      }

      // 새 Job 생성
      const now = Date.now()
      const scheduledTime = exec.scheduledAt?.getTime() || now
      const delayMs = Math.max(0, scheduledTime - now)

      await addSequenceEmailJob(
        {
          executionId: exec.executionId,
          enrollmentId: exec.enrollmentId,
          stepId: exec.stepId,
          stepOrder: exec.stepOrder,
          leadId: exec.leadId,
          leadCompanyName: exec.leadCompanyName,
          emailAccountId: exec.emailAccountId,
          emailSubject: exec.emailSubject || "",
          emailBodyText: exec.emailBodyText,
          emailBodyHtml: exec.emailBodyHtml,
          sequenceName: exec.sequenceName,
          sequenceId: exec.sequenceId,
          workspaceId: exec.workspaceId,
          userId: exec.userId,
          attachments: exec.attachments as
            | Array<{ filename: string; type: string; content: string }>
            | null,
        },
        {
          delay: delayMs,
          jobId: `seq-email-${exec.executionId}`,
        },
      )

      migrated++
    } catch (error) {
      failed++
      logger.error(
        { executionId: exec.executionId, error },
        "[Migration] Failed to migrate execution",
      )
    }
  }

  logger.info({ migrated, skipped, failed }, "[Migration] Pending executions migration completed")
  return { migrated, skipped, failed }
}
```

---

## 4. 아키텍처 변경

### 4.1 Before (60초 폴링)

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Server (elysia-server)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌───────────────────┐    ┌──────────────────────────────┐   │
│   │ API Endpoints     │    │ 60-Second Polling Worker     │   │
│   │                   │    │                              │   │
│   │ POST /enrollments │    │ setInterval(60s)             │   │
│   │       │           │    │       │                      │   │
│   │       ▼           │    │       ▼                      │   │
│   │ INSERT into       │    │ SELECT pending WHERE         │   │
│   │ step_executions   │    │ scheduled_at <= NOW()        │   │
│   │                   │    │ FOR UPDATE SKIP LOCKED       │   │
│   └───────────────────┘    │       │                      │   │
│                            │       ▼                      │   │
│                            │ Process & Send Email         │   │
│                            │       │                      │   │
│                            │       ▼                      │   │
│                            │ UPDATE status='sent'         │   │
│                            └──────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │  PostgreSQL  │
                            └──────────────┘
```

**문제점:**
- 매 60초마다 DB 폴링 (불필요한 쿼리)
- 최대 60초 지연
- 상태 체크 누락 (paused 시퀀스에도 발송)
- 재시도 로직 없음

### 4.2 After (BullMQ 이벤트 기반)

```
┌────────────────────────────────┐     ┌────────────────────────────────┐
│     API Server (elysia)        │     │   BullMQ Worker (worker.ts)    │
├────────────────────────────────┤     ├────────────────────────────────┤
│                                │     │                                │
│ POST /enrollments              │     │ SequenceEmailWorker            │
│       │                        │     │       │                        │
│       ▼                        │     │       ▼                        │
│ INSERT step_executions         │     │ 1. Check sequence.status       │
│       │                        │     │    (must be 'active')          │
│       ▼                        │     │       │                        │
│ ADD BullMQ Jobs                │     │       ▼                        │
│ (with delay based on           │     │ 2. Check enrollment.status     │
│  scheduledAt)                  │     │    (must be 'active')          │
│       │                        │     │       │                        │
│       ▼                        │     │       ▼                        │
│   ┌───────┐                    │     │ 3. Check lead.leadStatus       │
│   │ Redis │◄───────────────────┼─────│    (skip if 'unsubscribed')    │
│   └───────┘                    │     │       │                        │
│                                │     │       ▼                        │
└────────────────────────────────┘     │ 4. Verify email (Hunter.io)    │
                                       │       │                        │
                                       │       ▼                        │
                                       │ 5. Send via SendGrid/Nylas     │
                                       │       │                        │
                                       │       ▼                        │
                                       │ 6. Update step_execution       │
                                       │       │                        │
                                       │       ▼                        │
                                       │ 7. Log to job_logs table       │
                                       │                                │
                                       └────────────────────────────────┘
```

**개선점:**
- 이벤트 기반 즉시 처리
- `delay` 옵션으로 정확한 스케줄링
- 안전 체크 강화
- 자동 재시도 및 스톨 감지
- PostgreSQL job_logs에 이력 기록

---

## 5. 시나리오별 동작 프로세스

### 5.1 신규 리드 등록 (새 캠페인)

```
User Action: 캠페인 생성 → 리드 등록 → 시퀀스 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] API: POST /api/v1/sequences/{id}/enroll
         │
         ▼
[Step 2] sequence.service.ts: bulkEnrollWithScheduling()
         │
         ├─► INSERT sequence_enrollments (status: 'active')
         │
         ├─► INSERT sequence_step_executions (status: 'pending')
         │   - step 1: scheduledAt = NOW
         │   - step 2: scheduledAt = NOW + 3 days
         │   - step 3: scheduledAt = NOW + 7 days
         │
         └─► ADD BullMQ Jobs (NEW!)
             - Job 1: delay = 0ms,      jobId = 'seq-email-{exec1-id}'
             - Job 2: delay = 259200000, jobId = 'seq-email-{exec2-id}'
             - Job 3: delay = 604800000, jobId = 'seq-email-{exec3-id}'

[Step 3] Redis: Jobs queued with delays
         │
         ▼
[Step 4] BullMQ Worker: Processes Job 1 immediately
         │
         ├─► Check sequence.status === 'active' ✓
         ├─► Check enrollment.status === 'active' ✓
         ├─► Check lead.leadStatus !== 'unsubscribed' ✓
         ├─► Verify email with Hunter.io
         ├─► Send email via SendGrid
         ├─► UPDATE step_execution SET status = 'sent'
         └─► INSERT into job_logs

[Step 5] After 3 days: BullMQ Worker processes Job 2
         (same flow as Step 4)

[Step 6] After 7 days: BullMQ Worker processes Job 3
         (same flow as Step 4)
```

### 5.2 시퀀스 일시정지 (Pause)

```
User Action: 캠페인 일시정지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] API: PATCH /api/v1/sequences/{id}
         Body: { status: 'paused' }
         │
         ▼
[Step 2] UPDATE sequences SET status = 'paused'

[Step 3] BullMQ Worker가 다음 Job 처리 시도 시:
         │
         ├─► Check sequence.status === 'active'
         │   ❌ FAILED: status is 'paused'
         │
         └─► UPDATE step_execution SET status = 'skipped'
             errorMessage = 'Sequence status: paused'

[결과]
- 이미 큐에 있는 Job들은 실행되지만 스킵됨
- step_execution status = 'skipped'로 업데이트
- 이메일 발송 안됨 ✓
```

### 5.3 시퀀스 재개 (Resume)

```
User Action: 캠페인 재개
━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] API: PATCH /api/v1/sequences/{id}
         Body: { status: 'active' }
         │
         ▼
[Step 2] UPDATE sequences SET status = 'active'

[Step 3] 기존 skipped된 execution 재스케줄링 필요
         │
         ▼
[Step 4] API: POST /api/v1/sequences/{id}/requeue
         │
         └─► migratePendingExecutionsToBullMQ(sequenceId)
             - pending/skipped execution을 새 Job으로 생성
             - delay = 0 (즉시 실행)

[Step 5] BullMQ Worker가 새 Job 처리:
         │
         ├─► Check sequence.status === 'active' ✓
         ├─► 정상 발송 진행
```

### 5.4 리드 구독 취소 (Unsubscribe)

```
User Action: 리드가 구독 취소 링크 클릭
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] API: POST /api/v1/leads/{id}/unsubscribe
         │
         ▼
[Step 2] UPDATE leads SET lead_status = 'unsubscribed'

[Step 3] BullMQ Worker가 해당 리드의 Job 처리 시:
         │
         ├─► Check sequence.status === 'active' ✓
         ├─► Check enrollment.status === 'active' ✓
         ├─► Check lead.leadStatus !== 'unsubscribed'
         │   ❌ FAILED: lead_status is 'unsubscribed'
         │
         └─► UPDATE step_execution SET status = 'skipped'
             errorMessage = 'Lead status: unsubscribed'

[결과]
- 해당 리드에게 더 이상 이메일 발송 안됨
- 법적 컴플라이언스 준수 ✓
```

### 5.5 이메일 검증 실패 (Undeliverable)

```
BullMQ Worker Processing
━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] Worker가 Job 처리 시작
         │
         ▼
[Step 2] Verify email with Hunter.io
         │
         └─► Result: 'undeliverable'

[Step 3] 대체 이메일 찾기 시도:
         │
         ├─► Try 1: Gemini 웹사이트 enrichment
         │   - 웹사이트에서 이메일 추출
         │   - 추출된 이메일 Hunter.io 검증
         │
         └─► Try 2: Hunter.io Domain Search
             - 도메인에서 이메일 목록 조회
             - 각 이메일 검증

[Step 4-A] 대체 이메일 발견 시:
         │
         ├─► UPDATE lead_contacts SET contact_value = newEmail
         └─► 정상 발송 진행

[Step 4-B] 대체 이메일 없음:
         │
         └─► UPDATE step_execution SET status = 'failed'
             errorMessage = 'No valid email found after verification'

[60초 워커와의 차이]
- 60초 워커: 리드 삭제
- BullMQ 워커: failed로 마킹 (데이터 보존)
```

### 5.6 등록 일시정지 (Enrollment Stop)

```
User Action: 특정 리드의 시퀀스 진행 중단
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] API: PATCH /api/v1/enrollments/{id}
         Body: { status: 'stopped' }
         │
         ▼
[Step 2] UPDATE sequence_enrollments SET status = 'stopped'

[Step 3] BullMQ Worker가 해당 enrollment의 Job 처리 시:
         │
         ├─► Check sequence.status === 'active' ✓
         ├─► Check enrollment.status === 'active'
         │   ❌ FAILED: status is 'stopped'
         │
         └─► UPDATE step_execution SET status = 'skipped'
             errorMessage = 'Enrollment status: stopped'

[결과]
- 해당 리드의 남은 스텝들 모두 스킵
- 다른 리드들은 정상 진행
```

### 5.7 이메일 발송 실패 및 재시도

```
BullMQ Worker Processing
━━━━━━━━━━━━━━━━━━━━━━━━

[Attempt 1] Job 처리 시작
         │
         ├─► 모든 체크 통과 ✓
         ├─► Send email via SendGrid
         │   ❌ ERROR: 'Connection timeout'
         │
         └─► BullMQ: Job failed, scheduling retry
             - backoff: exponential (1s, 2s, 4s)

[Attempt 2] 1초 후 재시도
         │
         ├─► Send email via SendGrid
         │   ❌ ERROR: 'Rate limit exceeded'
         │
         └─► BullMQ: Job failed, scheduling retry

[Attempt 3] 3초 후 재시도 (2s backoff)
         │
         ├─► Send email via SendGrid
         │   ✓ SUCCESS
         │
         └─► UPDATE step_execution SET status = 'sent'

[job_logs 기록]
- attemptsMade: 3
- status: 'completed'
- outputData: { previousError: 'Rate limit exceeded', ... }
```

### 5.8 기존 Pending Execution 마이그레이션

```
Admin Action: 마이그레이션 실행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] Call migratePendingExecutionsToBullMQ()
         │
         ▼
[Step 2] SELECT all pending executions
         WHERE status = 'pending'
         AND scheduledAt <= NOW()
         │
         ▼
[Step 3] For each execution:
         │
         ├─► Check existing BullMQ Job
         │   - If active/waiting/delayed → skip
         │
         ├─► Calculate delay
         │   - If scheduledAt < NOW → delay = 0
         │   - If scheduledAt > NOW → delay = diff
         │
         └─► ADD BullMQ Job
             jobId = 'seq-email-{executionId}'

[결과]
- migrated: 2,585 (active sequences)
- skipped: 0 (no existing jobs)
- failed: 0

[참고] paused 시퀀스의 pending execution은:
- BullMQ에 Job 생성됨
- 실행 시 sequence.status 체크에서 스킵됨
- 시퀀스 재개 후 다시 마이그레이션 필요
```

---

## 6. 데이터 호환성

### 6.1 DB 스키마 호환

| 테이블 | 변경 | 호환성 |
|--------|------|--------|
| `sequences` | 없음 | ✅ 완전 호환 |
| `sequence_enrollments` | 없음 | ✅ 완전 호환 |
| `sequence_step_executions` | 없음 | ✅ 완전 호환 |
| `sequence_steps` | 없음 | ✅ 완전 호환 |
| `job_logs` | 기존 존재 | ✅ 완전 호환 |
| `leads` | 없음 | ✅ 완전 호환 |
| `lead_contacts` | 없음 | ✅ 완전 호환 |

### 6.2 Redis 데이터 호환

| 키 패턴 | 용도 | 호환성 |
|---------|------|--------|
| `bull:sequence-email:*` | BullMQ 큐 | ✅ 신규 생성 |
| `bull:test-queue:*` | 기존 테스트 큐 | ✅ 영향 없음 |
| `rate-limit:*` | Rate limiting | ✅ 영향 없음 |

### 6.3 현재 데이터 상태 (2025-01-02)

```sql
-- Pending Executions 분포
SELECT
  s.status as sequence_status,
  e.status as enrollment_status,
  sse.status as execution_status,
  COUNT(*) as count
FROM sequence_step_executions sse
JOIN sequence_enrollments e ON e.id = sse.enrollment_id
JOIN sequences s ON s.id = e.sequence_id
WHERE sse.status = 'pending'
GROUP BY s.status, e.status, sse.status;

-- 결과:
-- paused  | active    | pending | 2,955  ← BullMQ에서 스킵됨
-- active  | active    | pending | 2,585  ← BullMQ에서 발송됨
-- paused  | completed | pending |     3  ← BullMQ에서 스킵됨
-- paused  | stopped   | pending |     2  ← BullMQ에서 스킵됨
```

---

## 7. 모니터링

### 7.1 Health Endpoints

| 엔드포인트 | 용도 | 응답 |
|------------|------|------|
| `GET :3010/healthz` | Liveness probe | `{ status: 'ok' }` |
| `GET :3010/readyz` | Readiness probe | `{ status: 'healthy/degraded/unhealthy' }` |
| `GET :3010/health` | 상세 상태 | Redis, Worker, Queue, Memory 상태 |
| `GET :3010/metrics` | 전체 메트릭 | Queue counts, Worker stats, System info |

### 7.2 job_logs 테이블

```sql
-- 최근 24시간 통계
SELECT
  queue_name,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms
FROM job_logs
WHERE added_at > NOW() - INTERVAL '24 hours'
GROUP BY queue_name, status;

-- 에러 코드별 통계
SELECT
  error_code,
  COUNT(*) as count
FROM job_logs
WHERE status = 'failed'
  AND added_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

### 7.3 Redis Queue 모니터링

```bash
# RedisInsight 접속
https://sendgrinda.cloud/redisinsight/

# 또는 CLI
redis-cli -a sendgrid_redis_password_2024 \
  KEYS "bull:sequence-email:*" | wc -l
```

---

## 8. 배포 가이드

### 8.1 사전 체크

```bash
# 1. 로컬 빌드 확인
bun run build

# 2. 타입 체크
bun run typecheck

# 3. 린트 체크
bun run lint
```

### 8.2 배포 절차

```bash
# 1. 코드 푸시 (자동 배포)
git add .
git commit -m "feat: migrate to BullMQ sequence email worker"
git push origin main

# 2. 배포 확인
ssh send docker ps -a

# 3. 로그 확인
ssh send "docker logs send-grid-test-bullmq-worker-1 --tail 50"
ssh send "docker logs send-grid-test-elysia-server-1 --tail 50"
```

### 8.3 배포 후 검증

```bash
# 1. Health check
curl https://api.grinda.ai:3010/health

# 2. BullMQ Worker 확인
ssh send "docker logs send-grid-test-bullmq-worker-1 2>&1 | grep SequenceEmailWorker"

# 3. 60초 워커가 실행 안되는지 확인
ssh send "docker logs send-grid-test-elysia-server-1 2>&1 | grep 'STEP-WORKER-V2'"
# 결과 없어야 함

# 4. DB job_logs 확인
ssh send "docker exec send-grid-test-postgres-1 psql -U postgres -d postgres -c \"
  SELECT queue_name, status, COUNT(*)
  FROM job_logs
  WHERE queue_name = 'sequence-email'
  GROUP BY queue_name, status;
\""
```

### 8.4 기존 Pending Execution 마이그레이션 (선택적)

```typescript
// 방법 1: API 엔드포인트 호출 (구현 필요)
// POST /api/v1/admin/migrate-pending-executions

// 방법 2: 직접 함수 호출
import { migratePendingExecutionsToBullMQ } from "./lib/queue/queues"
const result = await migratePendingExecutionsToBullMQ()
console.log(result) // { migrated: 2585, skipped: 0, failed: 0 }
```

---

## 9. 롤백 계획

### 9.1 롤백 트리거

- BullMQ Worker 지속적 실패
- Redis 연결 불안정
- 예상치 못한 대량 이메일 발송

### 9.2 롤백 절차

```bash
# 1. 60초 워커 복구 코드로 revert
git revert <commit-hash>
git push origin main

# 2. 또는 수동으로 index.ts 수정
# startEmailSequenceWorker() 다시 활성화

# 3. BullMQ Worker에서 sequence-email 큐 처리 중단
# worker.ts에서 SequenceEmailWorker 주석 처리

# 4. Redis 큐 정리 (선택적)
redis-cli -a sendgrid_redis_password_2024 \
  EVAL "return redis.call('del', unpack(redis.call('keys', 'bull:sequence-email:*')))" 0
```

### 9.3 롤백 후 데이터 복구

```sql
-- BullMQ에서 skipped된 execution 다시 pending으로
UPDATE sequence_step_executions
SET status = 'pending', error_message = NULL
WHERE status = 'skipped'
  AND error_message LIKE '%Sequence status:%'
  AND updated_at > '2025-01-02';
```

---

## 부록: 파일별 변경 diff 요약

### A. `src/index.ts`

```diff
- import { startEmailSequenceWorker } from "./workers/email-sequence-worker-v2"
+ // NOTE: 60-second email sequence worker removed - replaced by BullMQ worker
+ // import { startEmailSequenceWorker } from "./workers/email-sequence-worker-v2"

  if (!isDevelopment) {
-   startEmailSequenceWorker()
+   // Email sequence emails are now processed by BullMQ worker (SequenceEmailWorker)
+   // See: src/workers/bullmq/sequence-email.worker.ts
    startWorkflowExecutionWorker()
    startScheduledEmailWorker()
-   logger.info("[Worker] sequence, workflow, scheduled-email started")
+   logger.info("[Worker] workflow, scheduled-email started (sequence emails handled by BullMQ)")
  }
```

### B. `src/services/sequence.service.ts`

```diff
+ import { addSequenceEmailJobs } from "../lib/queue/queues"
+ import type { SequenceEmailJob } from "../lib/queue/types"

  // bulkEnrollWithScheduling() 내부
+ const [sequenceInfo] = await db
+   .select({ name, workspaceId, createdBy })
+   .from(sequences)
+   .where(eq(sequences.id, data.sequenceId))

  const leadsWithEmails = await db
    .select({
      leadId: leads.id,
      email: leadContacts.contactValue,
+     companyName: leads.companyName,
    })

- await db.insert(sequenceStepExecutions).values(stepExecutionValues)
+ const insertedExecutions = await db
+   .insert(sequenceStepExecutions)
+   .values(stepExecutionValues)
+   .returning({ id: sequenceStepExecutions.id })

+ // BullMQ Job 생성 로직 추가 (약 40줄)
+ const bullmqJobs = [...]
+ await addSequenceEmailJobs(bullmqJobs)
```

### C. `src/lib/queue/queues.ts`

```diff
+ export async function migratePendingExecutionsToBullMQ(sequenceId?: string): Promise<{
+   migrated: number
+   skipped: number
+   failed: number
+ }> {
+   // ... 약 80줄의 마이그레이션 로직
+ }
+
+ export async function enqueueExistingPendingExecutions(sequenceId: string) {
+   return migratePendingExecutionsToBullMQ(sequenceId)
+ }
```

---

*문서 끝*
