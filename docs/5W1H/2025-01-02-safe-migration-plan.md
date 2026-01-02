# BullMQ 안전 마이그레이션 계획

> 작성일: 2025-01-02
> 버전: 1.0
> 상태: 최종 검토 대기

---

## 목차

1. [마이그레이션 개요](#1-마이그레이션-개요)
2. [현재 상태 분석](#2-현재-상태-분석)
3. [마이그레이션 필요 코드 분석](#3-마이그레이션-필요-코드-분석)
4. [단계별 마이그레이션 계획](#4-단계별-마이그레이션-계획)
5. [안전장치 및 검증](#5-안전장치-및-검증)
6. [롤백 계획](#6-롤백-계획)
7. [체크리스트](#7-체크리스트)

---

## 1. 마이그레이션 개요

### 1.1 마이그레이션 유형

| 구분 | 내용 | 필요 여부 |
|------|------|----------|
| **DB 스키마** | 테이블/컬럼 변경 | ❌ 불필요 (100% 호환) |
| **DB 데이터** | 기존 데이터 변환 | ❌ 불필요 |
| **Redis 데이터** | BullMQ Job 생성 | ✅ 필요 (일회성) |
| **코드 배포** | 60초→BullMQ 전환 | ✅ 필요 |

### 1.2 마이그레이션 위험도

| 위험 요소 | 위험도 | 대응 방안 |
|----------|--------|----------|
| 중복 이메일 발송 | 낮음 | jobId 기반 중복 방지 |
| 이메일 누락 | 낮음 | pending 마이그레이션 + Worker 안전 체크 |
| 서비스 중단 | 없음 | 무중단 배포 |
| 데이터 손실 | 없음 | DB는 변경 없음 |

---

## 2. 현재 상태 분석

### 2.1 Pending 이메일 현황 (2025-01-02 기준)

```
총 Pending 건수: 3,757건

시퀀스 상태별:
├─ active 시퀀스: 785건 (실제 발송 대상)
└─ paused 시퀀스: 2,972건 (발송 스킵)

등록 상태별:
├─ active 등록: 3,636건
├─ completed 등록: 3건
└─ stopped 등록: 2건

워크스페이스별:
├─ 이예인 회사: 3,242건 (86%)
├─ 린다 코스메틱: 165건
├─ 기타 7개: 350건
```

### 2.2 Active 시퀀스 상세 (즉시 발송 대상)

| 워크스페이스 | 시퀀스 | 건수 | 예정 시각 (UTC) | 상태 |
|--------------|--------|------|-----------------|------|
| 브이엠시드니_코스메틱 | Happy New Year! | 1 | 02:57 | Overdue |
| 이예인 회사 | 전체 리드 캠페인 | 647 | 05:00 | Overdue |
| 닥터봄 | 데모 이메일 시퀀스 | 28 | 09:59 | Future |
| PITONE | 데모 이메일 시퀀스 | 51 | 13:32 | Future |
| 주식회사 네이처렌 | 데모 이메일 시퀀스 | 58 | 01/03~05 | Future |

---

## 3. 마이그레이션 필요 코드 분석

### 3.1 필요한 마이그레이션 코드 (이미 구현됨)

**위치**: `src/lib/queue/queues.ts`

```typescript
/**
 * migratePendingExecutionsToBullMQ()
 *
 * 기존 pending execution을 BullMQ Job으로 마이그레이션
 * 60초 워커에서 BullMQ 워커로 전환 시 일회성 실행
 */
export async function migratePendingExecutionsToBullMQ(sequenceId?: string): Promise<{
  migrated: number
  skipped: number
  failed: number
}> {
  // 1. DB에서 모든 pending execution 조회
  // 2. 각 execution에 대해 BullMQ Job 생성
  // 3. 기존 Job 존재 시 스킵 (중복 방지)
  // 4. 결과 반환
}
```

**기능 요약**:
- DB의 pending execution을 Redis Job으로 변환
- 중복 Job 자동 스킵
- sequenceId 지정 시 특정 시퀀스만 마이그레이션
- 실패 건수 추적

### 3.2 추가 필요 코드: 마이그레이션 API 엔드포인트

현재 마이그레이션 함수는 존재하지만 **호출할 API가 없음**.
아래 코드를 추가하여 안전하게 마이그레이션을 실행할 수 있도록 함.

**추가할 파일**: `src/routes/admin-migration.routes.ts`

```typescript
import { Elysia, t } from "elysia"
import { migratePendingExecutionsToBullMQ, getSequenceEmailQueueStatus } from "../lib/queue/queues"
import logger from "../utils/logger"

export const adminMigrationRoutes = new Elysia({ prefix: "/api/v1/admin/migration" })
  /**
   * 마이그레이션 상태 조회
   */
  .get("/status", async () => {
    try {
      const queueStatus = await getSequenceEmailQueueStatus()
      return {
        success: true,
        data: {
          queue: queueStatus,
          message: "Query DB for pending executions to see full migration status",
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get status",
      }
    }
  })

  /**
   * Dry-run 마이그레이션 (실제 Job 생성 없이 분석만)
   */
  .post("/analyze", async ({ body }) => {
    try {
      // Lazy import for analysis
      const { db } = await import("../db")
      const { and, eq, lte } = await import("drizzle-orm")
      const { sequenceStepExecutions, sequenceEnrollments, sequences } = await import(
        "../db/schema/sequences"
      )

      const conditions = [
        eq(sequenceStepExecutions.status, "pending"),
        lte(sequenceStepExecutions.scheduledAt, new Date()),
      ]

      if (body?.sequenceId) {
        conditions.push(eq(sequences.id, body.sequenceId))
      }

      const pendingCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(sequenceStepExecutions)
        .innerJoin(sequenceEnrollments, eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id))
        .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
        .where(and(...conditions))

      return {
        success: true,
        data: {
          pendingExecutions: Number(pendingCount[0]?.count || 0),
          sequenceId: body?.sequenceId || "all",
          note: "This is a dry-run analysis. Use POST /execute to run the migration.",
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze",
      }
    }
  }, {
    body: t.Optional(t.Object({
      sequenceId: t.Optional(t.String()),
    })),
  })

  /**
   * 마이그레이션 실행
   */
  .post("/execute", async ({ body }) => {
    try {
      logger.info({ sequenceId: body?.sequenceId }, "[Migration] Starting pending executions migration")

      const result = await migratePendingExecutionsToBullMQ(body?.sequenceId)

      logger.info(result, "[Migration] Migration completed")

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      logger.error({ error }, "[Migration] Migration failed")
      return {
        success: false,
        error: error instanceof Error ? error.message : "Migration failed",
      }
    }
  }, {
    body: t.Optional(t.Object({
      sequenceId: t.Optional(t.String()),
    })),
  })
```

**`src/index.ts`에 추가**:
```typescript
import { adminMigrationRoutes } from "./routes/admin-migration.routes"
// ...
.use(adminMigrationRoutes)
```

### 3.3 대안: API 없이 마이그레이션 (권장)

API 엔드포인트 없이 **BullMQ Worker 시작 시 자동 마이그레이션** 실행:

**`src/worker.ts` 수정**:
```typescript
import { migratePendingExecutionsToBullMQ } from "./lib/queue/queues"

// Worker 초기화 후 마이그레이션 실행
async function initializeWorker() {
  // 기존 Worker 등록 코드...

  // 마이그레이션 실행 (일회성)
  try {
    logger.info("[Worker] Starting pending executions migration...")
    const result = await migratePendingExecutionsToBullMQ()
    logger.info(result, "[Worker] Migration completed")
  } catch (error) {
    logger.error({ error }, "[Worker] Migration failed - will retry on next restart")
    // 실패해도 Worker는 계속 실행 (기존 데이터에는 영향 없음)
  }
}

initializeWorker()
```

---

## 4. 단계별 마이그레이션 계획

### Phase 1: 준비 (배포 전)

```
시간: D-1

체크리스트:
□ 로컬 빌드 확인: bun run build
□ 타입 체크: bun run typecheck
□ 린트 체크: bun run lint
□ 현재 pending 건수 백업 (쿼리 결과 저장)
□ 롤백 계획 확인
```

### Phase 2: 사전 통보

```
시간: D-0, 배포 1시간 전

대상: 마케팅팀, 영업팀
내용:
- 시스템 업그레이드 예정
- 서비스 중단 없음
- 이메일 발송 정확도 개선
```

### Phase 3: 배포

```
시간: D-0

Step 1: 코드 푸시 (자동 배포)
─────────────────────────────
$ git push origin main

Step 2: 배포 확인 (약 2-3분)
─────────────────────────────
$ ssh send "docker ps -a | grep -E 'elysia|bullmq'"

예상 결과:
- elysia-server: Up
- bullmq-worker: Up

Step 3: 로그 확인
─────────────────────────────
# BullMQ Worker 시작 확인
$ ssh send "docker logs send-grid-test-bullmq-worker-1 --tail 100"

확인 포인트:
✓ "SequenceEmailWorker registered"
✓ "[Worker] Starting pending executions migration..."
✓ "[Worker] Migration completed { migrated: XX, skipped: XX, failed: XX }"

# 60초 워커 미실행 확인
$ ssh send "docker logs send-grid-test-elysia-server-1 2>&1 | grep 'STEP-WORKER-V2'"
결과: 없어야 함
```

### Phase 4: 검증

```
시간: 배포 후 5분

Step 1: Health Check
─────────────────────────────
$ curl https://api.grinda.ai:3010/health

예상 응답:
{
  "status": "healthy",
  "redis": { "connected": true },
  "workers": { "sequence-email": { "running": true } }
}

Step 2: Queue 상태 확인
─────────────────────────────
$ curl https://api.grinda.ai/api/v1/bullmq-test/queues

확인 포인트:
- sequence-email 큐에 Job 존재
- delayed 카운트 > 0 (미래 스케줄)
- waiting 카운트 ≥ 0 (overdue 항목)

Step 3: DB 상태 확인
─────────────────────────────
# pending 건수가 줄어들지 않았는지 확인 (마이그레이션은 DB를 변경하지 않음)
$ ssh send "docker exec send-grid-test-postgres-1 psql -U postgres -d postgres -c \"
  SELECT COUNT(*) FROM sequence_step_executions WHERE status = 'pending';
\""

Step 4: Job 로그 확인
─────────────────────────────
$ ssh send "docker exec send-grid-test-postgres-1 psql -U postgres -d postgres -c \"
  SELECT COUNT(*), status
  FROM job_logs
  WHERE queue_name = 'sequence-email'
    AND added_at > NOW() - INTERVAL '10 minutes'
  GROUP BY status;
\""
```

### Phase 5: 모니터링 (배포 후 24시간)

```
시간: D+1

모니터링 항목:
□ 이메일 발송 성공률
□ 실패 Job 건수
□ 재시도 성공률
□ 평균 처리 시간

알림 설정:
- 실패율 > 5%: Warning
- 실패율 > 10%: Critical
```

---

## 5. 안전장치 및 검증

### 5.1 중복 발송 방지

```typescript
// queues.ts의 addSequenceEmailJob()
const deduplicationJobId = `seq-email-${data.executionId}`

// 기존 Job 확인
const existingJob = await sequenceEmailQueue.getJob(deduplicationJobId)
if (existingJob) {
  const state = await existingJob.getState()
  if (state === "waiting" || state === "delayed" || state === "active") {
    return existingJob  // 기존 Job 반환 (새로 생성 안함)
  }
}
```

**검증 방법**:
```bash
# 동일 executionId로 중복 Job 없는지 확인
$ redis-cli -a sendgrid_redis_password_2024 \
  KEYS "bull:sequence-email:*" | wc -l
```

### 5.2 상태 불일치 방지

```typescript
// sequence-email.worker.ts
// 1. 시퀀스 상태 체크
const sequence = await db.select().from(sequences).where(eq(sequences.id, job.data.sequenceId))
if (sequence.status !== 'active') {
  // 스킵 처리
  await updateStepExecution(job.data.executionId, { status: 'skipped' })
  return { skipped: true, reason: `Sequence status: ${sequence.status}` }
}

// 2. 등록 상태 체크
// 3. 리드 상태 체크
// ... (동일 패턴)
```

### 5.3 발송 누락 방지

**마이그레이션 함수의 안전장치**:
```typescript
// 이미 Job이 있는 경우 스킵 (재마이그레이션 안전)
if (existingJob) {
  const state = await existingJob.getState()
  if (state === "active" || state === "waiting" || state === "delayed") {
    skipped++
    continue
  }
}
```

**Worker의 안전장치**:
```typescript
// execution 상태 확인 후 처리
const execution = await db.select().from(sequenceStepExecutions)
  .where(eq(sequenceStepExecutions.id, job.data.executionId))

if (execution.status !== 'pending') {
  // 이미 처리됨 → 스킵
  return { skipped: true, reason: `Already ${execution.status}` }
}
```

---

## 6. 롤백 계획

### 6.1 롤백 트리거

| 상황 | 심각도 | 롤백 필요 |
|------|--------|----------|
| BullMQ Worker 크래시 (5분 이상) | Critical | ✅ 롤백 |
| Redis 연결 실패 (5분 이상) | Critical | ✅ 롤백 |
| 대량 이메일 발송 오류 | High | ✅ 롤백 |
| 일부 Job 실패 (< 5%) | Medium | ❌ 모니터링 |
| 단발성 오류 | Low | ❌ 무시 |

### 6.2 롤백 절차

```bash
# Step 1: Git Revert
$ git revert <commit-hash>
$ git push origin main

# Step 2: 배포 대기 (자동, 약 2-3분)

# Step 3: 60초 워커 실행 확인
$ ssh send "docker logs send-grid-test-elysia-server-1 --tail 20 | grep 'STEP-WORKER-V2'"
# 출력: "[STEP-WORKER-V2] Started..."

# Step 4: BullMQ 큐 정리 (선택적)
$ ssh send "docker exec send-grid-test-redis-1 redis-cli -a sendgrid_redis_password_2024 \
  EVAL \"return redis.call('del', unpack(redis.call('keys', 'bull:sequence-email:*')))\" 0"
```

### 6.3 롤백 후 데이터 복구

```sql
-- BullMQ에서 'skipped'된 execution을 'pending'으로 복구
UPDATE sequence_step_executions
SET status = 'pending', error_message = NULL, updated_at = NOW()
WHERE status = 'skipped'
  AND error_message LIKE 'Sequence status:%'
  AND updated_at > '2025-01-02';

-- 영향받은 건수 확인
SELECT COUNT(*) FROM sequence_step_executions
WHERE status = 'pending' AND updated_at > '2025-01-02';
```

---

## 7. 체크리스트

### 7.1 배포 전 체크리스트

```
[ ] 로컬 빌드 성공: bun run build
[ ] 타입 체크 통과: bun run typecheck
[ ] 린트 체크 통과: bun run lint
[ ] 현재 pending 건수 기록
[ ] 롤백 절차 숙지
[ ] 관련 팀 사전 통보
```

### 7.2 배포 중 체크리스트

```
[ ] git push origin main 실행
[ ] docker ps -a로 컨테이너 확인
[ ] BullMQ Worker 로그 확인
  [ ] "SequenceEmailWorker registered" 출력
  [ ] "Migration completed" 출력
[ ] elysia-server 로그 확인
  [ ] "STEP-WORKER-V2" 없음
[ ] Health check 응답 확인
```

### 7.3 배포 후 체크리스트

```
[ ] Queue 상태 확인 (waiting, delayed, active)
[ ] 첫 번째 이메일 발송 성공 확인
[ ] job_logs 테이블에 기록 확인
[ ] 오류 로그 없음 확인
[ ] 24시간 모니터링 설정
```

### 7.4 비상 연락처

| 역할 | 담당자 | 연락처 |
|------|--------|--------|
| 개발 리드 | TBD | TBD |
| DevOps | TBD | TBD |
| 프로덕트 | TBD | TBD |

---

## 부록: 유용한 명령어

### A. 서버 접속 및 상태 확인

```bash
# 서버 접속
ssh send

# Docker 상태
docker ps -a | grep -E "elysia|bullmq|redis|postgres"

# 로그 확인 (최근 100줄)
docker logs send-grid-test-elysia-server-1 --tail 100
docker logs send-grid-test-bullmq-worker-1 --tail 100
```

### B. Redis 상태 확인

```bash
# Redis 접속
docker exec -it send-grid-test-redis-1 redis-cli -a sendgrid_redis_password_2024

# 큐 키 목록
KEYS bull:sequence-email:*

# Job 수 확인
LLEN bull:sequence-email:waiting
ZCARD bull:sequence-email:delayed
```

### C. PostgreSQL 쿼리

```bash
# DB 접속
docker exec -it send-grid-test-postgres-1 psql -U postgres -d postgres

# Pending execution 확인
SELECT COUNT(*),
  CASE WHEN scheduled_at < NOW() THEN 'overdue' ELSE 'future' END as timing
FROM sequence_step_executions
WHERE status = 'pending'
GROUP BY timing;

# Job 로그 확인
SELECT status, COUNT(*), AVG(duration_ms)
FROM job_logs
WHERE queue_name = 'sequence-email'
  AND added_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

---

*문서 끝*
