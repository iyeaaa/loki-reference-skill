# 워크플로우 실행 시스템 구현 완료

## ✅ 구현 완료된 기능

### 1. 워크플로우 실행 데이터 스키마
**파일:** `elysia-server/src/db/schema/workflow-executions.ts`

**테이블:**
- `workflow_enrollments`: 워크플로우에 등록된 lead 추적 (sequence_enrollments와 별개)
- `workflow_execution_logs`: 각 노드 실행 기록

**마이그레이션:** `migrations/create_workflow_executions.sql` ✓ 적용 완료

### 2. 워크플로우 실행 엔진
**파일:** `elysia-server/src/services/workflow-execution.service.ts`

**핵심 기능:**
- ✅ 워크플로우에 lead 등록 (`enrollInWorkflow`, `bulkEnrollInWorkflow`)
- ✅ 노드 순회 및 실행 (`executeWorkflow`)
- ✅ 이메일 초안 노드 실행 (`executeEmailDraftNode`)
  - 생성된 이메일 조회
  - SendGrid를 통한 이메일 발송
  - 발송 기록 저장
- ✅ 타이머 노드 실행 (`executeTimerNode`)
  - 대기 시간 스케줄링
  - 다음 노드 예약
- ✅ 노드별 통계 조회 (`getNodeStatistics`)
  - 발송 수
  - 답장 수
  - 대기 수

### 3. 워크플로우 실행 워커
**파일:** `elysia-server/src/workers/workflow-execution-worker.ts`

**기능:**
- ✅ **활성화된 시퀀스만 처리** (status = 'active')
- ✅ 1분마다 스케줄된 워크플로우 자동 실행
- ✅ 30초마다 답장 체크 및 워크플로우 자동 중단
- ✅ 백그라운드 자동 실행

**자동 실행:** `elysia-server/src/index.ts`에서 `startWorkflowExecutionWorker()` 호출

### 4. 타이머 노드 통계 API
**파일:** `elysia-server/src/routes/workflow-execution.routes.ts`

**엔드포인트:**
```typescript
GET /api/v1/sequences/:id/nodes/:nodeId/stats
→ { nodeId, sentCount, repliedCount, waitingCount }
```

**추가 엔드포인트:**
- `GET /api/v1/sequences/:id/workflow-enrollments` - 등록 목록
- `POST /api/v1/sequences/:id/workflow-enrollments` - 단일 등록
- `POST /api/v1/sequences/:id/workflow-enrollments/bulk` - 일괄 등록
- `POST /api/v1/sequences/:id/workflow-enrollments/:enrollmentId/execute` - 수동 실행

### 5. 프론트엔드 실시간 통계
**파일:** 
- `admin/src/lib/api/hooks/workflow-execution.ts`
- `admin/src/pages/sequences/designer/nodes/TimerNode.tsx`

**기능:**
- ✅ 30초마다 자동 갱신 (React Query polling)
- ✅ 타이머 노드에 실시간 통계 표시

### 6. AI 이메일 생성 진행률
**파일:**
- `elysia-server/src/services/generation-progress.service.ts`
- `admin/src/lib/api/hooks/workflow-emails.ts`
- `admin/src/pages/sequences/designer/EmailManagementModal.tsx`

**기능:**
- ✅ 생성 진행률 메모리 추적
- ✅ 2초마다 실시간 업데이트
- ✅ Progress Bar UI 표시
- ✅ 실패 개수 표시

**엔드포인트:**
```typescript
GET /api/v1/sequences/:id/nodes/:nodeId/generation-progress
→ { total, generated, failed, percentage, status, ... }
```

### 7. 고객그룹 필수 검증
**파일:**
- `admin/src/pages/sequences/SequenceForm.tsx`
- `elysia-server/src/routes/sequences.routes.ts`

**검증:**
- ✅ 프론트엔드: 폼 제출 시 검증
- ✅ 백엔드: API 레벨 검증
- ✅ UI: 필수 표시 (빨간 별표)
- ✅ 도움말 메시지 추가

### 8. 워크플로우 정합성 검증
**파일:**
- `elysia-server/src/services/workflow-validation.service.ts`
- `elysia-server/src/routes/sequences.routes.ts`
- `admin/src/pages/sequences/SequenceForm.tsx`

**검증 시점:**
- ✅ **활성화 상태로 변경할 때만 검증** (status → 'active')
- ✅ 저장 시에는 검증하지 않음 (자유롭게 편집 가능)

**검증 항목:**
- ✅ 시작 노드 존재 여부
- ✅ 이메일 노드: 생성 모드, AI 프롬프트/제목/본문
- ✅ 타이머 노드: 대기 시간 (1일 이상)
- ✅ 노드 연결 상태 (고아 노드 체크)
- ✅ 순환 참조 감지

**시퀀스 생성 제약:**
- ✅ 초안(draft) 또는 일시정지(paused) 상태로만 생성 가능
- ✅ 생성 시 활성/보관 상태 선택 불가 (UI에서 숨김)

## 🔧 주요 수정 사항

### Lint 에러 수정
1. ✅ TypeScript 타입 에러 모두 수정
2. ✅ `any` 타입 명확한 인터페이스로 대체
3. ✅ Null/undefined 체크 추가
4. ✅ 테이블 컬럼명 수정 (`replied_emails` → `email_replies`)
5. ✅ Import 경로 수정 (`EmailService` → `emailService`)

### 워크플로우 실행 로직
1. ✅ **활성 시퀀스만 실행** (`sequences.status = 'active'`)
2. ✅ **활성 enrollment만 실행** (`workflow_enrollments.status = 'active'`)
3. ✅ 답장 자동 감지로 워크플로우 중단
4. ✅ 이메일 발송 실패 시 로그 기록

### 데이터 검증
1. ✅ 활성화 시에만 워크플로우 검증
2. ✅ 생성 시 초안/일시정지만 허용
3. ✅ 고객그룹 필수 검증

## 📊 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Sequence Designer UI                      │
│                      (React Flow)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ workflowData (JSON)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   sequences.workflow_data                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ 활성화 & 고객그룹 등록
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              workflow_enrollments (등록)                     │
│  - 각 lead별로 워크플로우 진행 상태 추적                     │
│  - currentNodeId: 현재 실행 중인 노드                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ 노드 실행
                      ↓
┌─────────────────────────────────────────────────────────────┐
│         workflow_execution_logs (실행 로그)                  │
│  - 각 노드 실행 기록                                         │
│  - 이메일 발송 기록                                          │
│  - 타이머 스케줄링                                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ↓                         ↓
┌─────────────────┐      ┌─────────────────┐
│  Email 발송     │      │  Timer 스케줄   │
│  (SendGrid)     │      │  (다음 실행)    │
└─────────────────┘      └─────────────────┘
         │                         │
         │                         │
         ↓                         ↓
┌─────────────────────────────────────────┐
│    Workflow Execution Worker            │
│    - 1분마다 스케줄 확인 및 실행       │
│    - 30초마다 답장 체크                 │
│    - **활성 시퀀스만 처리**             │
└─────────────────────────────────────────┘
```

## 🚀 사용 흐름

### 1단계: 시퀀스 생성
```typescript
POST /api/v1/sequences
{
  "workspaceId": "uuid",
  "customerGroupId": "uuid", // 필수!
  "name": "신규 고객 온보딩",
  "status": "draft" // 또는 "paused"만 가능
}
```

### 2단계: 워크플로우 디자인
- `/sequences/:id/designer`에서 노드 추가
- 자유롭게 편집 및 저장 (검증 없음)

### 3단계: 활성화 (검증 실행)
```typescript
PUT /api/v1/sequences/:id
{
  "status": "active" // 이 시점에 워크플로우 검증!
}
```

**검증 항목:**
- 워크플로우 존재 여부
- 모든 노드 필수 데이터
- 노드 연결 상태
- 순환 참조

### 4단계: 고객 등록
```typescript
POST /api/v1/sequences/:id/workflow-enrollments/bulk
{
  "customerGroupId": "uuid",
  "userEmailAccountId": "uuid"
}
```

### 5단계: 자동 실행
- 워커가 1분마다 활성 시퀀스의 스케줄 확인
- 답장이 오면 자동으로 워크플로우 중단
- 타이머 노드에서 실시간 통계 확인 가능

## 🔍 핵심 개선 사항

1. **sequence_steps와 분리**
   - 구 기능(sequence_steps)과 신 기능(workflow) 독립적으로 동작
   - 두 시스템 모두 유지

2. **활성 시퀀스만 실행**
   - 워커가 `sequences.status = 'active'`인 시퀀스만 처리
   - 일시정지/초안 상태는 실행 안 됨

3. **검증 시점 최적화**
   - 저장 시: 검증 없음 (자유롭게 편집)
   - 활성화 시: 엄격한 검증 1회

4. **타입 안전성**
   - 모든 TypeScript/Biome lint 에러 해결
   - 명확한 타입 정의
   - Null/undefined 체크

5. **실시간 모니터링**
   - 타이머 통계: 30초마다 자동 갱신
   - AI 생성 진행률: 2초마다 업데이트

## 📁 생성된 파일 목록

### 백엔드
1. `elysia-server/src/db/schema/workflow-executions.ts` - 스키마
2. `elysia-server/src/services/workflow-execution.service.ts` - 실행 엔진
3. `elysia-server/src/services/workflow-validation.service.ts` - 검증
4. `elysia-server/src/services/generation-progress.service.ts` - 진행률 추적
5. `elysia-server/src/routes/workflow-execution.routes.ts` - API
6. `elysia-server/src/workers/workflow-execution-worker.ts` - 워커
7. `elysia-server/migrations/create_workflow_executions.sql` - 마이그레이션
8. `elysia-server/scripts/migrate-workflow-executions.ts` - 마이그레이션 스크립트

### 프론트엔드
1. `admin/src/lib/api/services/workflow-execution.ts` - API 서비스
2. `admin/src/lib/api/hooks/workflow-execution.ts` - React Query 훅
3. `admin/src/pages/sequences/SequenceActivationDialog.tsx` - 활성화 다이얼로그

### 수정된 파일
**백엔드:**
- `elysia-server/src/index.ts` - 워커 시작
- `elysia-server/src/db/schema.ts` - 스키마 export
- `elysia-server/src/routes/sequences.routes.ts` - 검증 로직
- `elysia-server/src/routes/workflow-emails.routes.ts` - 진행률 API
- `elysia-server/src/db/schema/sequences.ts` - customerGroupId NOT NULL

**프론트엔드:**
- `admin/src/pages/sequences/designer/SequenceDesigner.tsx` - 검증 제거
- `admin/src/pages/sequences/designer/nodes/TimerNode.tsx` - 실시간 통계
- `admin/src/pages/sequences/designer/EmailManagementModal.tsx` - 진행률 표시
- `admin/src/pages/sequences/SequenceForm.tsx` - 고객그룹 필수, 상태 제한
- `admin/src/lib/api/services/workflow-emails.ts` - 진행률 API
- `admin/src/lib/api/hooks/workflow-emails.ts` - 진행률 훅

## 🎯 주요 개선 포인트

### Before → After

1. **타이머 통계**
   - Before: 하드코딩된 목업 데이터
   - After: 실시간 API 조회 (30초 자동 갱신)

2. **AI 생성 진행률**
   - Before: 고정값 50%
   - After: 실시간 진행률 (생성/실패 개수 표시)

3. **검증 시점**
   - Before: 저장 시마다 검증
   - After: 활성화 시에만 1회 검증

4. **워크플로우 실행**
   - Before: sequence_steps만 사용
   - After: workflow 노드 기반 독립 실행

5. **상태 관리**
   - Before: 모든 상태에서 실행
   - After: 활성 시퀀스만 실행

## 🔗 구 기능과의 관계

**완전히 분리된 시스템:**
- `sequence_steps` (구 기능) ← `email-sequence-worker.ts`
- `workflow_executions` (신 기능) ← `workflow-execution-worker.ts`

두 워커가 독립적으로 실행되며 서로 간섭하지 않습니다.

## ✅ Lint 체크 완료

모든 파일의 TypeScript/Biome lint 에러 해결:
- ✅ 타입 안전성 확보
- ✅ Null/undefined 체크
- ✅ 명확한 타입 정의
- ✅ 에러 처리 개선

