# BullMQ 완전 전환 분석 및 마이그레이션 계획

작성일: 2025-01-02
상태: 분석 완료, 구현 대기

---

## Executive Summary

60초 폴링 워커에서 BullMQ 이벤트 기반 워커로 완전 전환이 **가능**합니다.
단, 기존 pending execution 마이그레이션과 enrollment 시 Job 생성 연동이 필수입니다.

---

## 1. What (무엇을)

### 현재 상태

| 구성 요소 | 60초 워커 | BullMQ 워커 | 상태 |
|-----------|-----------|-------------|------|
| 기본 처리 로직 | ✅ 완성 | ✅ 완성 | 동일 |
| Hunter API 인증 | ✅ 완성 | ✅ 완성 | 동일 |
| 대체 이메일 찾기 | ✅ 완성 | ✅ 완성 | 동일 |
| 리드 삭제 (이메일 없음) | ✅ 완성 | ✅ 완성 | 동일 |
| 드래프트 지원 | ✅ 완성 | ✅ 완성 | 동일 |
| 템플릿 변수 치환 | ✅ 완성 | ✅ 완성 | 동일 |
| 이메일 스레딩 | ✅ 완성 | ✅ 완성 | 동일 |
| 첨부파일 지원 | ✅ 완성 | ✅ 완성 | 동일 |
| 멀티 프로바이더 | ✅ 완성 | ✅ 완성 | 동일 |
| 동시 처리 (10개) | ✅ p-limit(10) | ✅ concurrency=10 | 동일 |
| 상태 체크 | ✅ SQL WHERE | ✅ 코드 내 체크 | 동일 |
| DB 로깅 | ❌ 없음 | ✅ job_logs 테이블 | BullMQ 우수 |
| 재시도 | ❌ 없음 | ✅ 3회 exponential | BullMQ 우수 |
| 지연 처리 | ❌ 폴링 대기 | ✅ delay 옵션 | BullMQ 우수 |
| Job 생성 연동 | N/A | ❌ 없음 | **구현 필요** |
| 기존 데이터 마이그레이션 | N/A | ❌ 없음 | **구현 필요** |

### 변경 대상

```
src/services/sequence.service.ts
  └── bulkEnrollWithScheduling()  → Job enqueue 연동 추가
  └── updateSequence()            → Pause/Resume 시 Job 관리 추가

src/workers/email-sequence-worker-v2.ts
  └── 전체 파일 제거 (deprecated)

src/index.ts
  └── startEmailSequenceWorker() 호출 제거
```

---

## 2. Why (왜)

### 60초 워커의 한계

| 문제 | 영향 | 심각도 |
|------|------|--------|
| 폴링 오버헤드 | 매 60초 DB 조회, 처리할 것 없어도 쿼리 실행 | 중 |
| 지연 시간 | 최대 60초 대기 후 처리 시작 | 중 |
| 재시도 없음 | 일시적 오류 시 영구 실패 처리 | 높음 |
| 모니터링 어려움 | 진행 상황 추적 불가 | 중 |
| 스케일 한계 | 단일 인스턴스 의존 | 중 |

### BullMQ의 장점

| 장점 | 설명 |
|------|------|
| 이벤트 기반 | Job이 생성되면 즉시 처리 시작 |
| 자동 재시도 | 3회 exponential backoff (30s → 60s → 120s) |
| 지연 처리 | scheduledAt 기반 delay 설정 가능 |
| 모니터링 | job_logs 테이블 + Redis 상태 조회 |
| Stall 복구 | 30초마다 stalled job 감지 및 재처리 |
| 수평 확장 | 멀티 워커 인스턴스 지원 |

---

## 3. When (언제)

### 전환 타임라인

```
Phase 1: 준비 (즉시)
├── BullMQ 워커 상태 체크 완료 ✅
├── 확장 함수 구현 완료 ✅
└── 문서화 완료 ✅

Phase 2: 연동 (현재 작업)
├── bulkEnrollWithScheduling() Job 생성 연동
├── Pause/Resume 시 Job 관리 연동
└── 빌드 및 테스트

Phase 3: 마이그레이션 (배포 시점)
├── 기존 pending execution → BullMQ Job 마이그레이션
├── 60초 워커 중지
└── 모니터링 확인

Phase 4: 정리 (확인 후)
├── 60초 워커 코드 제거
└── 관련 import 정리
```

---

## 4. Where (어디서)

### 영향 범위

#### Database

| 테이블 | 영향 | 설명 |
|--------|------|------|
| sequence_step_executions | 읽기/쓰기 | status 필드 업데이트 |
| job_logs | 쓰기 | 모든 Job 로그 저장 |
| sequences | 읽기 | 상태 체크 |
| sequence_enrollments | 읽기/쓰기 | 상태 체크 + firstThreadId 저장 |
| leads | 읽기 | 상태 체크 + 정보 조회 |
| emails | 읽기/쓰기 | 드래프트 조회 + 발송 기록 |

#### Redis

| Key Pattern | 용도 | 영향 |
|-------------|------|------|
| bull:sequence-email:* | Job 큐 | 신규 생성 |
| bull:sequence-email:id | Job 데이터 | Job별 데이터 저장 |
| bull:sequence-email:delayed | 지연 Job | 스케줄된 Job 저장 |
| bull:sequence-email:completed | 완료 Job | 24시간 보관 |
| bull:sequence-email:failed | 실패 Job | 7일 보관 |

#### Infrastructure

| 구성 요소 | 변경 | 설명 |
|-----------|------|------|
| API Server | 코드 수정 | 60초 워커 시작 제거 |
| Worker Process | 영향 없음 | 이미 BullMQ 워커 실행 중 |
| Redis | 데이터 증가 | Job 데이터 저장 |
| PostgreSQL | 부하 동일 | 조회 패턴 동일 |

---

## 5. Who (누가)

### 관련자

| 역할 | 영향 | 조치 |
|------|------|------|
| 개발자 | 코드 변경 | 마이그레이션 구현 |
| 운영자 | 모니터링 | 새 메트릭 대시보드 추가 |
| 사용자 | 성능 개선 | 더 빠른 이메일 발송 |

---

## 6. How (어떻게)

### 6.1 bulkEnrollWithScheduling() 수정

```typescript
// 수정 전: DB에만 step execution 생성
await db.insert(sequenceStepExecutions).values(stepExecutionValues)

// 수정 후: DB 생성 + BullMQ Job 생성
const insertedExecutions = await db
  .insert(sequenceStepExecutions)
  .values(stepExecutionValues)
  .returning({ id: sequenceStepExecutions.id, stepId: sequenceStepExecutions.stepId })

// BullMQ Job 생성 (delay 기반)
const jobs = insertedExecutions.map((exec, idx) => {
  const stepValue = stepExecutionValues[idx]
  const step = steps.find(s => s.id === stepValue.stepId)
  const delayMs = Math.max(0, stepValue.scheduledAt.getTime() - Date.now())

  return {
    data: {
      executionId: exec.id,
      enrollmentId: stepValue.enrollmentId,
      stepId: stepValue.stepId,
      stepOrder: stepValue.stepOrder,
      leadId: enrollment.leadId,
      // ... 기타 필요 데이터
    },
    opts: {
      delay: delayMs,
      jobId: `seq-email-${exec.id}`,
    }
  }
})

await addSequenceEmailJobs(jobs)
```

### 6.2 기존 Pending Execution 마이그레이션

```typescript
// 마이그레이션 함수 (일회성 실행)
async function migrateExistingPendingExecutions() {
  const pendingExecutions = await db
    .select({
      executionId: sequenceStepExecutions.id,
      enrollmentId: sequenceStepExecutions.enrollmentId,
      stepId: sequenceStepExecutions.stepId,
      stepOrder: sequenceStepExecutions.stepOrder,
      scheduledAt: sequenceStepExecutions.scheduledAt,
      // ... 조인으로 필요 데이터 조회
    })
    .from(sequenceStepExecutions)
    .innerJoin(...)
    .where(eq(sequenceStepExecutions.status, 'pending'))

  const jobs = pendingExecutions.map(exec => ({
    data: { ... },
    opts: {
      delay: Math.max(0, exec.scheduledAt.getTime() - Date.now()),
      jobId: `seq-email-${exec.executionId}`,
    }
  }))

  await addSequenceEmailJobs(jobs)
}
```

### 6.3 Pause/Resume 처리

```typescript
// Pause 시
async function pauseSequence(sequenceId: string) {
  await db.update(sequences).set({ status: 'paused' }).where(eq(sequences.id, sequenceId))
  // BullMQ 워커가 Job 실행 시 상태 체크하므로 Job 취소 불필요
  // (선택적) waiting/delayed Job 취소로 리소스 절약
  // await cancelSequenceJobs(sequenceId)
}

// Resume 시
async function resumeSequence(sequenceId: string) {
  await db.update(sequences).set({ status: 'active' }).where(eq(sequences.id, sequenceId))
  // pending execution들의 Job이 없으면 다시 생성
  await enqueueExistingPendingExecutions(sequenceId)
}
```

---

## 7. 시나리오별 2중 체크

### 시나리오 1: 기존 캠페인 (이미 실행 중)

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| 기존 pending execution 처리 | ✅ | 마이그레이션 스크립트로 Job 생성 |
| 기존 processing execution 처리 | ✅ | BullMQ 워커 시작 시 processing → pending 복구 불필요 (60초 워커 중지 후 복구 실행) |
| 기존 sent/failed execution | ✅ | 변경 없음, 그대로 유지 |

### 시나리오 2: 새 캠페인 생성

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| step execution 생성 | ✅ | DB에 생성 |
| BullMQ Job 생성 | ✅ | addSequenceEmailJobs() 호출 |
| scheduledAt 기반 delay | ✅ | Job opts.delay로 설정 |
| 중복 Job 방지 | ✅ | jobId로 deduplication |

### 시나리오 3: 캠페인 일시정지 (Pause)

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| sequence.status 변경 | ✅ | 'paused'로 업데이트 |
| BullMQ 워커 상태 체크 | ✅ | Job 실행 시 sequence.status='active' 확인 |
| waiting Job 처리 | ✅ | 실행 시점에 skip 처리 |
| 이메일 발송 차단 | ✅ | 상태 체크로 발송 안됨 |

### 시나리오 4: 캠페인 재활성화 (Resume)

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| sequence.status 변경 | ✅ | 'active'로 업데이트 |
| 기존 Job 상태 | ✅ | skip된 Job은 재처리 안됨 |
| pending execution 재등록 | ✅ | enqueueExistingPendingExecutions() 호출 |
| 발송 재개 | ✅ | 새 Job으로 처리 |

### 시나리오 5: 캠페인 내용 수정

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| step 내용 변경 | ✅ | DB 업데이트 |
| 이미 생성된 Job | ✅ | executionId만 저장, 실행 시 DB 조회 |
| 새 내용 반영 | ✅ | 발송 시점에 최신 데이터 사용 |

### 시나리오 6: 리드 탈퇴/반송

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| lead.leadStatus 변경 | ✅ | 'unsubscribed'로 업데이트 |
| BullMQ 워커 상태 체크 | ✅ | Job 실행 시 lead.leadStatus 확인 |
| 이메일 발송 차단 | ✅ | skip 처리 |
| step execution 상태 | ✅ | 'skipped'로 업데이트 |

### 시나리오 7: 서버 크래시 복구

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| active Job 복구 | ✅ | BullMQ stall detection (30초) |
| 재시도 | ✅ | 자동 3회 재시도 |
| processing execution 복구 | ⚠️ | 60초 워커 중지 전 실행 필요 |

### 시나리오 8: 동시 처리

| 체크 항목 | 결과 | 설명 |
|-----------|------|------|
| 병렬 처리 수 | ✅ | concurrency=10 |
| Hunter API 레이트 리밋 | ✅ | 10 req/sec 준수 |
| 중복 처리 방지 | ✅ | jobId deduplication + execution status 체크 |

---

## 8. Action Items

### 필수 작업

- [ ] sequence.service.ts에 addSequenceEmailJobs() import 추가
- [ ] bulkEnrollWithScheduling()에 Job 생성 연동 추가
- [ ] 마이그레이션 함수 구현 (enqueueExistingPendingExecutions)
- [ ] 빌드 확인
- [ ] 마이그레이션 스크립트 실행 (배포 시)
- [ ] 60초 워커 중지 (index.ts에서 startEmailSequenceWorker() 제거)
- [ ] 60초 워커 파일 제거 또는 deprecated 처리

### 선택 작업

- [ ] Pause 시 Job 취소 (cancelSequenceJobs 호출 추가)
- [ ] Resume 시 Job 재생성 확인 로직 추가
- [ ] 모니터링 대시보드 업데이트

---

## 9. 롤백 계획

전환 실패 시:

1. BullMQ 워커 상태 체크 조건에 항상 false 반환 추가 (비활성화)
2. 60초 워커 재활성화 (startEmailSequenceWorker() 복원)
3. Redis 큐 정리 (선택)

---

## 10. 결론

BullMQ 완전 전환은 **기술적으로 가능**하며, 성능 및 안정성 면에서 **권장**됩니다.

핵심 요구사항:
1. bulkEnrollWithScheduling()에 Job 생성 연동
2. 기존 pending execution 마이그레이션
3. 순차적 전환 (마이그레이션 → 60초 워커 중지)

예상 효과:
- 이메일 발송 지연 시간 최소화 (60초 → 즉시)
- 자동 재시도로 일시적 오류 복구
- 상세 모니터링 및 디버깅 지원
- 수평 확장 가능한 아키텍처
