# BullMQ Test Worker 기록 관리 가이드

## 개요

현재 시스템에서 BullMQ를 사용하는 유일한 워커는 `test.worker.ts`입니다. 이 문서는 해당 워커의 아키텍처, 현재 기록 관리 방식, 그리고 DB 저장을 위한 개선 방안을 설명합니다.

---

## 1. 현재 아키텍처

### 1.1 시스템 구성

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Compose 환경                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ elysia-server│    │bullmq-worker │    │    redis     │      │
│  │   (API)      │    │ (독립 프로세스)│    │   (Queue)    │      │
│  │   :3001      │    │              │    │   :6379      │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │              │
│         │   Queue.add()     │   Worker.process  │              │
│         └───────────────────┼───────────────────┘              │
│                             │                                  │
│                    ┌────────▼────────┐                         │
│                    │    postgres     │                         │
│                    │   (미사용 상태)  │                         │
│                    │     :5432       │                         │
│                    └─────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 파일 구조

```
elysia-server/
├── src/
│   ├── worker.ts                      # Worker 프로세스 엔트리포인트
│   ├── lib/
│   │   ├── queue/
│   │   │   ├── types.ts               # Job 타입 정의
│   │   │   ├── queues.ts              # Queue 인스턴스
│   │   │   └── index.ts
│   │   └── redis/
│   │       ├── connection.ts          # Redis 연결 설정
│   │       └── index.ts
│   └── workers/
│       └── bullmq/
│           ├── test.worker.ts         # Test Worker 구현
│           └── index.ts
├── Dockerfile.worker                   # Worker 전용 Docker 이미지
└── docker-compose.yml                  # bullmq-worker 서비스 정의
```

---

## 2. 현재 기록 관리 방식

### 2.1 Redis 기반 Job 저장 (BullMQ 기본)

BullMQ는 모든 Job 데이터를 Redis에 저장합니다.

**저장 위치**: `queues.ts:83-99`
```typescript
export const testQueue = new Queue<TestJob>(QUEUE_NAMES.TEST_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600,    // 완료된 Job은 1시간 후 삭제
      count: 100,   // 최대 100개 유지
    },
    removeOnFail: {
      age: 3600,    // 실패한 Job은 1시간 후 삭제
    },
  },
})
```

**Redis Key 구조**:
```
bull:test-queue:id          # Job ID 카운터
bull:test-queue:waiting     # 대기 중인 Job 목록
bull:test-queue:active      # 실행 중인 Job 목록
bull:test-queue:completed   # 완료된 Job 목록
bull:test-queue:failed      # 실패한 Job 목록
bull:test-queue:delayed     # 지연된 Job 목록
bull:test-queue:{jobId}     # 개별 Job 데이터 (Hash)
```

### 2.2 로깅 기반 기록

**Worker 이벤트 로깅**: `test.worker.ts:59-77`
```typescript
// 완료 이벤트
testWorker.on("completed", (job, result) => {
  logger.info({ jobId: job.id, result }, "[TestWorker] Job completed successfully")
})

// 실패 이벤트
testWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, error: err.message, attempts: job?.attemptsMade },
    "[TestWorker] Job failed",
  )
})

// 에러 이벤트
testWorker.on("error", (err) => {
  logger.error({ error: err.message }, "[TestWorker] Worker error")
})

// Stalled 이벤트
testWorker.on("stalled", (jobId) => {
  logger.warn({ jobId }, "[TestWorker] Job stalled")
})
```

**로그 예시**:
```json
{"level":30,"time":1702800000000,"pid":1,"jobId":"1","message":"test message","attempt":1,"msg":"[TestWorker] Processing job"}
{"level":30,"time":1702800001000,"pid":1,"jobId":"1","result":{"success":true,"processedAt":"2024-12-17T10:00:01.000Z","message":"Processed: test message"},"msg":"[TestWorker] Job completed successfully"}
```

### 2.3 현재 기록 관리의 한계

| 항목 | Redis | 로그 | PostgreSQL |
|------|-------|------|------------|
| 저장 여부 | O | O | X |
| 영속성 | 제한적 (1시간) | O (파일 기반) | - |
| 조회 용이성 | 제한적 | 어려움 | - |
| 통계/분석 | 어려움 | 어려움 | - |
| 대시보드 연동 | 가능 (Bull Board) | 불가 | - |

---

## 3. Job 타입 정의

### 3.1 TestJob 입력 타입

**파일**: `types.ts:62-68`
```typescript
export interface TestJob {
  message: string              // 테스트 메시지
  delay?: number               // 처리 지연 시간 (ms)
  shouldFail?: boolean         // 의도적 실패 여부
  data?: Record<string, unknown>  // 추가 데이터
}
```

### 3.2 TestJobResult 출력 타입

**파일**: `types.ts:78-83`
```typescript
export interface TestJobResult {
  success: boolean             // 성공 여부
  processedAt: string          // 처리 완료 시각 (ISO)
  message: string              // 결과 메시지
  receivedData?: Record<string, unknown>  // 입력 데이터 반환
}
```

---

## 4. Job 처리 흐름

### 4.1 Job 추가 (Producer)

```typescript
import { testQueue } from "./lib/queue"

// 기본 Job 추가
await testQueue.add("test-job", {
  message: "Hello BullMQ",
  data: { key: "value" }
})

// 지연 Job 추가
await testQueue.add("delayed-job", {
  message: "Delayed message",
  delay: 2000  // 2초 처리 지연
}, {
  delay: 5000  // 5초 후 실행
})

// 우선순위 Job 추가
await testQueue.add("priority-job", {
  message: "High priority"
}, {
  priority: 1  // 낮을수록 높은 우선순위
})
```

### 4.2 Job 처리 (Consumer)

**파일**: `test.worker.ts:11-39`
```typescript
async function processTestJob(job: Job<TestJob, TestJobResult>): Promise<TestJobResult> {
  const { message, delay, shouldFail, data } = job.data

  // 1. 처리 시작 로깅
  logger.info(
    { jobId: job.id, message, attempt: job.attemptsMade + 1 },
    "[TestWorker] Processing job",
  )

  // 2. 지연 시뮬레이션
  if (delay && delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  // 3. 실패 시뮬레이션 (재시도 테스트용)
  if (shouldFail) {
    throw new Error(`Intentional failure for testing: ${message}`)
  }

  // 4. 결과 반환
  const result: TestJobResult = {
    success: true,
    processedAt: new Date().toISOString(),
    message: `Processed: ${message}`,
    receivedData: data,
  }

  logger.info({ jobId: job.id, result }, "[TestWorker] Job completed")
  return result
}
```

### 4.3 Worker 설정

**파일**: `test.worker.ts:50-57`
```typescript
testWorker = new Worker<TestJob, TestJobResult>(QUEUE_NAMES.TEST_QUEUE, processTestJob, {
  connection: createRedisConnection(),
  concurrency: 5,       // 동시 처리 Job 수
  limiter: {
    max: 10,            // 최대 10개
    duration: 1000,     // 1초당
  },
})
```

---

## 5. DB 저장 개선 방안

### 5.1 job_history 테이블 스키마

```typescript
// db/schema/job-history.ts
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

export const jobHistory = pgTable("job_history", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Job 식별
  jobId: varchar("job_id", { length: 255 }).notNull(),
  queueName: varchar("queue_name", { length: 100 }).notNull(),
  jobName: varchar("job_name", { length: 255 }),

  // 컨텍스트
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),

  // 상태 추적
  status: varchar("status", { length: 20 }).notNull(),
  // pending | active | completed | failed | stalled

  // 실행 정보
  attemptsMade: integer("attempts_made").default(0),
  maxAttempts: integer("max_attempts").default(3),

  // 타이밍
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  durationMs: integer("duration_ms"),

  // 데이터
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  errorMessage: text("error_message"),
  stackTrace: text("stack_trace"),

  // 메타데이터
  workerName: varchar("worker_name", { length: 100 }),
  processedBy: varchar("processed_by", { length: 255 }),
}, (table) => ({
  jobIdIdx: index("job_history_job_id_idx").on(table.jobId),
  queueNameIdx: index("job_history_queue_name_idx").on(table.queueName),
  statusIdx: index("job_history_status_idx").on(table.status),
  createdAtIdx: index("job_history_created_at_idx").on(table.createdAt),
}))
```

### 5.2 TrackedWorker 유틸리티

```typescript
// lib/queue/tracked-worker.ts
import { Job, Worker, type WorkerOptions } from "bullmq"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { jobHistory } from "../../db/schema/job-history"
import logger from "../../utils/logger"

export function createTrackedWorker<TData, TResult>(
  queueName: string,
  processor: (job: Job<TData, TResult>) => Promise<TResult>,
  options?: WorkerOptions
): Worker<TData, TResult> {

  const worker = new Worker<TData, TResult>(
    queueName,
    async (job) => {
      const startTime = Date.now()

      // Job 시작 기록
      await db.insert(jobHistory).values({
        jobId: job.id!,
        queueName,
        jobName: job.name,
        status: "active",
        attemptsMade: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts || 3,
        processedAt: new Date(),
        inputData: job.data as Record<string, unknown>,
        workerName: worker.name,
      }).onConflictDoUpdate({
        target: jobHistory.jobId,
        set: {
          status: "active",
          processedAt: new Date(),
          attemptsMade: job.attemptsMade + 1,
        }
      })

      return processor(job)
    },
    options
  )

  // 완료 이벤트 - DB 업데이트
  worker.on("completed", async (job, result) => {
    const duration = job.finishedOn && job.processedOn
      ? job.finishedOn - job.processedOn
      : null

    await db.update(jobHistory)
      .set({
        status: "completed",
        completedAt: new Date(),
        outputData: result as Record<string, unknown>,
        durationMs: duration,
      })
      .where(eq(jobHistory.jobId, job.id!))

    logger.info({ jobId: job.id, duration }, `[${queueName}] Job completed and saved to DB`)
  })

  // 실패 이벤트 - DB 업데이트
  worker.on("failed", async (job, error) => {
    if (!job) return

    await db.update(jobHistory)
      .set({
        status: "failed",
        failedAt: new Date(),
        errorMessage: error.message,
        stackTrace: error.stack,
        attemptsMade: job.attemptsMade,
      })
      .where(eq(jobHistory.jobId, job.id!))

    logger.error({ jobId: job.id, error: error.message }, `[${queueName}] Job failed and saved to DB`)
  })

  // Stalled 이벤트 - DB 업데이트
  worker.on("stalled", async (jobId) => {
    await db.update(jobHistory)
      .set({ status: "stalled" })
      .where(eq(jobHistory.jobId, jobId))

    logger.warn({ jobId }, `[${queueName}] Job stalled`)
  })

  return worker
}
```

### 5.3 개선된 Test Worker

```typescript
// workers/bullmq/test.worker.ts (개선 버전)
import { type Job } from "bullmq"
import { createTrackedWorker } from "../../lib/queue/tracked-worker"
import { QUEUE_NAMES, type TestJob, type TestJobResult } from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import logger from "../../utils/logger"

let testWorker: ReturnType<typeof createTrackedWorker<TestJob, TestJobResult>> | null = null

async function processTestJob(job: Job<TestJob, TestJobResult>): Promise<TestJobResult> {
  const { message, delay, shouldFail, data } = job.data

  logger.info(
    { jobId: job.id, message, attempt: job.attemptsMade + 1 },
    "[TestWorker] Processing job",
  )

  if (delay && delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  if (shouldFail) {
    throw new Error(`Intentional failure for testing: ${message}`)
  }

  return {
    success: true,
    processedAt: new Date().toISOString(),
    message: `Processed: ${message}`,
    receivedData: data,
  }
}

export function startTestWorker() {
  if (testWorker) {
    logger.warn("[TestWorker] Worker already running")
    return testWorker
  }

  // TrackedWorker 사용 - 자동 DB 저장
  testWorker = createTrackedWorker<TestJob, TestJobResult>(
    QUEUE_NAMES.TEST_QUEUE,
    processTestJob,
    {
      connection: createRedisConnection(),
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  )

  logger.info("[TestWorker] Started with DB tracking enabled")
  return testWorker
}
```

---

## 6. 모니터링 및 조회

### 6.1 Bull Board 연동

```typescript
// routes/admin/queue-dashboard.ts
import { createBullBoard } from "@bull-board/api"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { ElysiaAdapter } from "@bull-board/elysia"
import { testQueue } from "../../lib/queue"

const serverAdapter = new ElysiaAdapter("/admin/queues")

createBullBoard({
  queues: [new BullMQAdapter(testQueue)],
  serverAdapter,
})

export const queueDashboard = serverAdapter.registerPlugin()
```

### 6.2 Job History 조회 API

```typescript
// routes/admin/job-history.ts
import { and, desc, eq, gte, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../../db"
import { jobHistory } from "../../db/schema/job-history"

export const jobHistoryRoutes = new Elysia({ prefix: "/job-history" })
  // 목록 조회
  .get("/", async ({ query }) => {
    const { queueName, status, limit = 50, offset = 0 } = query

    const conditions = []
    if (queueName) conditions.push(eq(jobHistory.queueName, queueName))
    if (status) conditions.push(eq(jobHistory.status, status))

    const jobs = await db
      .select()
      .from(jobHistory)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobHistory.createdAt))
      .limit(limit)
      .offset(offset)

    return { jobs }
  })

  // 통계 조회
  .get("/stats", async ({ query }) => {
    const { hours = 24 } = query
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const stats = await db
      .select({
        queueName: jobHistory.queueName,
        status: jobHistory.status,
        count: sql<number>`count(*)`,
        avgDuration: sql<number>`avg(duration_ms)`,
        maxDuration: sql<number>`max(duration_ms)`,
      })
      .from(jobHistory)
      .where(gte(jobHistory.createdAt, since))
      .groupBy(jobHistory.queueName, jobHistory.status)

    return { stats, since }
  })

  // 실패한 Job 재시도
  .post("/:jobId/retry", async ({ params }) => {
    const job = await db
      .select()
      .from(jobHistory)
      .where(eq(jobHistory.jobId, params.jobId))
      .limit(1)

    if (!job[0] || job[0].status !== "failed") {
      return { error: "Job not found or not failed" }
    }

    // 재시도 로직...
    return { success: true }
  })
```

### 6.3 통계 쿼리 예시

```sql
-- 최근 24시간 큐별 성공/실패 통계
SELECT
  queue_name,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM job_history
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY queue_name, status
ORDER BY queue_name, status;

-- 시간대별 처리량
SELECT
  DATE_TRUNC('hour', completed_at) as hour,
  COUNT(*) as completed_count,
  AVG(duration_ms) as avg_duration
FROM job_history
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', completed_at)
ORDER BY hour DESC;

-- 실패율 높은 Job 유형
SELECT
  queue_name,
  job_name,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2) as fail_rate
FROM job_history
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY queue_name, job_name
HAVING COUNT(*) > 10
ORDER BY fail_rate DESC;
```

---

## 7. 운영 가이드

### 7.1 Docker 명령어

```bash
# Worker 로그 확인
docker logs -f bullmq-worker

# Worker 재시작
docker compose restart bullmq-worker

# Worker 스케일 아웃
docker compose up -d --scale bullmq-worker=3

# Redis 상태 확인
docker exec -it redis redis-cli -a sendgrid_redis_password_2024 INFO
```

### 7.2 RedisInsight 접속

- URL: `https://your-domain/redisinsight`
- Redis 연결 정보:
  - Host: `redis`
  - Port: `6379`
  - Password: `sendgrid_redis_password_2024`

### 7.3 Queue 상태 확인

```typescript
import { testQueue } from "./lib/queue"

// 대기 중인 Job 수
const waitingCount = await testQueue.getWaitingCount()

// 활성 Job 수
const activeCount = await testQueue.getActiveCount()

// 완료된 Job 수
const completedCount = await testQueue.getCompletedCount()

// 실패한 Job 수
const failedCount = await testQueue.getFailedCount()

// 전체 상태
const jobCounts = await testQueue.getJobCounts()
// { waiting: 0, active: 0, completed: 100, failed: 5, delayed: 0 }
```

---

## 8. 마이그레이션 체크리스트

### Phase 1: DB 스키마 추가
- [ ] `job_history` 테이블 스키마 생성
- [ ] Drizzle 마이그레이션 실행
- [ ] 인덱스 확인

### Phase 2: TrackedWorker 구현
- [ ] `tracked-worker.ts` 유틸리티 생성
- [ ] 에러 핸들링 추가
- [ ] 테스트 작성

### Phase 3: Test Worker 적용
- [ ] `test.worker.ts`를 TrackedWorker로 교체
- [ ] 로컬 테스트
- [ ] Docker 이미지 재빌드

### Phase 4: 모니터링 추가
- [ ] Bull Board 대시보드 연동
- [ ] Job History API 추가
- [ ] Admin 대시보드 UI 구현

---

## 참고 자료

- [BullMQ 공식 문서](https://docs.bullmq.io/)
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production)
- [Bull Board](https://github.com/felixmosh/bull-board)
- [Uber's Piper Architecture](https://www.uber.com/blog/managing-data-workflows-at-scale/)
