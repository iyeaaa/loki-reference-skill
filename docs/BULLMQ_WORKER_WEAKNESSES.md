# BullMQ Test Worker 구조 단점 및 약점 분석

## 개요

이 문서는 현재 BullMQ Test Worker 구조의 단점과 약점을 분석하고, 개선이 필요한 항목들을 우선순위별로 정리합니다.

---

## ~~1. 데이터 영속성 문제~~ ✅ 해결됨

> **해결 완료**: `job_logs` 테이블과 `JobLogService` 구현으로 모든 Job이 PostgreSQL에 영구 저장됩니다.
>
> - 스키마: `src/db/schema/job-logs.ts`
> - 서비스: `src/services/job-log.service.ts`
> - Worker 연동: `src/workers/bullmq/test.worker.ts`

---

## 2. 장애 복구 취약점

### 2.1 Worker 단일 장애점 (SPOF)

**현재 구조**:
```
┌──────────────────┐
│  bullmq-worker   │  ← 단일 인스턴스
│  (concurrency:5) │
└────────┬─────────┘
         │
    ┌────▼────┐
    │  Redis  │
    └─────────┘
```

**문제점**:
- Worker 컨테이너 장애 시 모든 Job 처리 중단
- `docker-compose.yml`에 `restart: always` 있지만 재시작 사이 Job 처리 지연
- 스케일 아웃 설정 없음

### ~~2.2 Stalled Job 처리 미비~~ ✅ 해결됨

> **해결 완료**: Stalled Job 발생 시 DB에 기록됩니다.
> ```typescript
> testWorker.on("stalled", async (jobId) => {
>   await jobLogService.logJobStalled(jobId, QUEUE_NAMES.TEST_QUEUE)
> })
> ```

### ~~2.3 Health Check 불완전~~ ✅ 해결됨

> **해결 완료**: HTTP 기반 종합 Health Check 서버 구현
>
> - Health 서버: `src/lib/health/worker-health.ts`
> - 엔드포인트:
>   - `GET /healthz` - Liveness probe
>   - `GET /readyz` - Readiness probe
>   - `GET /health` - 상세 상태
>   - `GET /metrics` - 전체 메트릭
>
> **체크 항목**:
> | 항목 | 상태 |
> |------|------|
> | Redis 연결 | ✅ (레이턴시 포함) |
> | Worker 프로세스 상태 | ✅ |
> | 처리 중인 Job 수 | ✅ |
> | 메모리 사용량 | ✅ |
> | 마지막 Job 처리 시간 | ✅ |
> | Queue 상태 (waiting/active/failed) | ✅ |

---

## 3. 모니터링 및 관찰성 부족

### 3.1 메트릭 수집 없음

**누락된 메트릭**:
```typescript
// 수집해야 하는 메트릭들
- job_processed_total{queue, status}     // 처리된 Job 수
- job_duration_seconds{queue}            // 처리 시간 히스토그램
- job_waiting_count{queue}               // 대기 중 Job 수
- job_active_count{queue}                // 활성 Job 수
- job_failed_total{queue, error_type}    // 실패 Job 수
- worker_concurrency{worker}             // Worker 동시성
```

### 3.2 분산 트레이싱 미지원

**현재 로깅** (`test.worker.ts:14-17`):
```typescript
logger.info(
  { jobId: job.id, message, attempt: job.attemptsMade + 1 },
  "[TestWorker] Processing job",
)
```

**누락된 정보**:
- Trace ID / Span ID
- Parent Job 추적 (Job 체이닝 시)
- 외부 서비스 호출 연관관계
- 요청 원점 (어떤 API에서 Job을 생성했는지)

### 3.3 알림 시스템 부재

```typescript
// 현재: 로그만 기록
testWorker.on("failed", (job, err) => {
  logger.error(...)  // 끝
})

// 필요한 것:
// - Slack/Discord 알림
// - 이메일 알림
// - PagerDuty 연동
// - 실패율 임계치 알람
```

---

## 4. 보안 취약점

### 4.1 Redis 비밀번호 하드코딩

**docker-compose.yml:94**:
```yaml
command: redis-server --appendonly yes --requirepass sendgrid_redis_password_2024
```

**문제점**:
- 비밀번호가 Git에 커밋됨
- 환경변수로 분리되지 않음
- 모든 개발자가 프로덕션 비밀번호 접근 가능

### 4.2 Job 데이터 암호화 없음

```typescript
// 민감 데이터가 평문으로 Redis에 저장됨
await testQueue.add("job", {
  message: "user@email.com",  // PII 데이터
  data: { apiKey: "sk-..." }   // 민감 정보
})
```

### 4.3 네트워크 격리 부족

**docker-compose.yml**:
```yaml
redis:
  ports:
    - "6379:6379"  # 외부 노출!
```

Redis 포트가 호스트에 바인딩되어 외부 접근 가능.

---

## 5. 확장성 한계

### 5.1 수평 확장 미지원

**현재 구조**:
```yaml
bullmq-worker:
  # scale 설정 없음
  # replica 설정 없음
```

Worker 인스턴스 증설 시:
- 상태 공유 메커니즘 없음
- 로드 밸런싱 설정 없음
- Job 분배 최적화 없음

### 5.2 Queue 분리 미흡

**queues.ts**:
```typescript
// 모든 큐가 동일한 Redis 인스턴스 사용
export const campaignEmailQueue = new Queue(..., { connection: redisConnection })
export const scheduledEmailQueue = new Queue(..., { connection: redisConnection })
export const workflowStepQueue = new Queue(..., { connection: redisConnection })
export const testQueue = new Queue(..., { connection: redisConnection })
```

**문제점**:
- 하나의 Redis 장애 시 모든 큐 영향
- 우선순위 큐 간 리소스 경합
- 트래픽 급증 시 전체 시스템 영향

### 5.3 Rate Limiting 불완전

**test.worker.ts:54-57**:
```typescript
limiter: {
  max: 10,
  duration: 1000,  // 1초당 10개
}
```

**한계**:
- 전역 Rate Limit만 존재
- 워크스페이스별 제한 없음
- 외부 API 호출 제한 미연동 (SendGrid 등)

---

## 6. 코드 품질 문제

### 6.1 에러 핸들링 불완전

**test.worker.ts:11-39**:
```typescript
async function processTestJob(job: Job<TestJob, TestJobResult>): Promise<TestJobResult> {
  // try-catch 없음
  // 에러 타입 분류 없음
  // 재시도 가능 여부 판단 없음

  if (shouldFail) {
    throw new Error(`...`)  // 모든 에러가 동일하게 처리됨
  }
}
```

**필요한 개선**:
```typescript
// 에러 타입별 분류
class RetryableError extends Error { retryable = true }
class FatalError extends Error { retryable = false }

// 에러별 다른 처리
if (error instanceof RetryableError) {
  // 재시도
} else {
  // Dead Letter Queue로 이동
}
```

### 6.2 Job 검증 부재

**types.ts:62-68**:
```typescript
export interface TestJob {
  message: string
  delay?: number
  shouldFail?: boolean
  data?: Record<string, unknown>
}
// 런타임 검증 없음
```

**문제점**:
- TypeScript 타입은 컴파일 타임만 체크
- 잘못된 Job 데이터가 런타임에 들어올 수 있음
- Zod/Joi 같은 런타임 검증 없음

### 6.3 테스트 코드 부재

```
elysia-server/
├── src/workers/bullmq/
│   └── test.worker.ts
└── test/
    └── (worker 테스트 없음)
```

**누락된 테스트**:
- 단위 테스트
- 통합 테스트
- 재시도 로직 테스트
- 동시성 테스트
- 장애 시나리오 테스트

---

## 7. 운영 관리 문제

### 7.1 Job 수동 관리 어려움

**현재**:
- 실패 Job 재시도 API 없음
- Job 취소 API 없음
- 대량 Job 정리 도구 없음
- 우선순위 변경 불가

### 7.2 배포 전략 부재

```yaml
bullmq-worker:
  # Rolling update 설정 없음
  # Blue-Green 배포 미지원
  # Graceful shutdown 의존성 문제
```

**문제점**:
- 배포 시 처리 중인 Job 유실 가능
- 무중단 배포 미지원
- 버전 롤백 시 Job 호환성 문제

### 7.3 로그 관리 부재

```yaml
bullmq-worker:
  # 로그 볼륨 마운트 없음
  # 로그 로테이션 설정 없음
  # 중앙 로그 수집 없음
```

---

## ~~8. 아키텍처 불일치~~ ✅ 부분 해결

### 8.1 하이브리드 방식의 복잡성

**현재 시스템**:
```
┌─────────────────────────────────────────────────────┐
│                    Workers                           │
├──────────────────┬──────────────────────────────────┤
│ BullMQ 기반      │ setInterval 기반                 │
├──────────────────┼──────────────────────────────────┤
│ test.worker      │ email-sequence-worker-v2         │
│                  │ workflow-execution-worker        │
│                  │ scheduled-email-worker           │
│                  │ email-draft-generator-worker     │
└──────────────────┴──────────────────────────────────┘
```

**문제점**:
- 두 가지 패턴 혼재로 복잡성 증가
- 각각 다른 모니터링 방식 필요
- 통합 대시보드 구축 어려움
- 개발자 혼란

### ~~8.2 DB 저장 불일치~~ ✅ 해결됨

| Worker | DB 저장 | 테이블 |
|--------|---------|--------|
| test.worker (BullMQ) | ✅ | `job_logs` |
| email-sequence-worker | ✅ | `sequence_step_executions` |
| workflow-execution-worker | ✅ | `workflow_execution_logs` |
| scheduled-email-worker | ✅ | `emails` |

> **해결 완료**: test.worker가 이제 `job_logs` 테이블에 모든 Job 이력을 저장합니다.

---

## 9. 우선순위별 개선 필요 항목

### 🔴 Critical (즉시 해결)

| # | 항목 | 위험도 | 예상 작업 |
|---|------|--------|----------|
| 1 | Redis `maxmemory-policy noeviction` 설정 | 데이터 손실 | docker-compose.yml 수정 |
| 2 | Redis 비밀번호 환경변수 분리 | 보안 위협 | .env 파일 분리 |
| 3 | Redis 포트 외부 노출 제거 | 보안 위협 | ports 설정 제거 |

**즉시 적용 가능한 수정**:
```yaml
# docker-compose.yml
redis:
  # ports:                    # 제거 또는 내부만
  #   - "6379:6379"
  command: >
    redis-server
    --appendonly yes
    --appendfsync everysec
    --maxmemory-policy noeviction
    --requirepass ${REDIS_PASSWORD}
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD}
```

### ~~🟠 High (1-2주 내)~~ ✅ 대부분 완료

| # | 항목 | 영향 | 상태 |
|---|------|------|------|
| 4 | Job History DB 저장 구현 | 추적성 | ✅ 완료 |
| 5 | Health Check 개선 | 안정성 | ✅ 완료 |
| 6 | 알림 시스템 연동 | 운영성 | 🔜 대기 |

### 🟡 Medium (1개월 내)

| # | 항목 | 영향 | 예상 작업 |
|---|------|------|----------|
| 7 | 메트릭 수집 (Prometheus) | 관찰성 | prom-client 연동 |
| 8 | 분산 트레이싱 (OpenTelemetry) | 디버깅 | OTEL SDK 추가 |
| 9 | 수평 확장 지원 | 확장성 | Docker Swarm/K8s |

### 🟢 Low (분기 내)

| # | 항목 | 영향 | 예상 작업 |
|---|------|------|----------|
| 10 | setInterval 워커 BullMQ 마이그레이션 | 일관성 | 전체 워커 리팩토링 |
| 11 | 테스트 코드 작성 | 품질 | Jest/Vitest 테스트 |
| 12 | Bull Board 대시보드 구축 | 운영성 | Admin UI 통합 |

---

## 10. 개선 로드맵

```
Phase 1: 보안 & 안정성 (Week 1-2)
├── Redis 설정 보안 강화
├── 환경변수 분리
└── Health Check 개선 ✅

Phase 2: 데이터 영속성 (Week 3-4) ✅ 완료
├── job_logs 테이블 생성 ✅
├── JobLogService 구현 ✅
├── test.worker 적용 ✅
└── HTTP Health Server 구현 ✅

Phase 3: 관찰성 (Month 2)
├── Prometheus 메트릭
├── Grafana 대시보드
└── 알림 시스템

Phase 4: 확장성 (Month 3)
├── Worker 스케일 아웃
├── Queue 분리 전략
└── 기존 워커 마이그레이션
```

---

## 참고 자료

- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Docker Compose Healthcheck](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/)
