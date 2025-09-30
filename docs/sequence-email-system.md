# 시퀀스 기반 이메일 발송 시스템

## 📌 개요

특정 고객 그룹에 대한 이메일 시퀀스를 자동으로 실행하는 시스템입니다. 고객 그룹을 시퀀스에 등록하면, 각 리드의 이메일 주소로 설정된 스케줄에 따라 자동으로 이메일이 발송됩니다.

### 핵심 기능

- ✉️ **다단계 이메일 시퀀스**: 여러 단계로 구성된 자동화된 이메일 캠페인
- ⏰ **스케줄 기반 발송**: 각 단계별 지연 시간 설정 (예: Day 0, Day 3, Day 7)
- 👥 **고객 그룹 일괄 등록**: 한 번에 여러 리드를 시퀀스에 등록
- 🤖 **자동 발송 워커**: 백그라운드에서 자동으로 이메일 발송
- 📊 **실시간 상태 추적**: 각 이메일의 발송 상태 및 진행도 모니터링
- 🔄 **진행 상태 관리**: 각 리드의 현재 단계 자동 업데이트

---

## 🏗️ 시스템 아키텍처

### 데이터베이스 스키마

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  sequences  │────▶│ sequenceSteps   │────▶│ sequenceStepExecutions│
└─────────────┘     └─────────────────┘     └──────────────────────┘
       │                                              │
       │                                              │
       ▼                                              ▼
┌──────────────────────┐                    ┌────────────────┐
│ sequenceEnrollments  │◀───────────────────│ leads          │
└──────────────────────┘                    └────────────────┘
       │                                              │
       │                                              ▼
       ▼                                     ┌────────────────┐
┌────────────────────┐                      │ leadContacts   │
│ customerGroups     │                      └────────────────┘
└────────────────────┘
```

#### 주요 테이블

1. **sequences**: 시퀀스 정보 (이름, 상태, 워크스페이스)
2. **sequenceSteps**: 시퀀스의 각 스텝 (순서, 지연 일수, 이메일 내용)
3. **sequenceEnrollments**: 리드의 시퀀스 등록 정보
4. **sequenceStepExecutions**: 실제 이메일 발송 스케줄 및 실행 상태
5. **customerGroups**: 고객 그룹
6. **customerGroupMembers**: 고객 그룹의 멤버 (리드)
7. **leads**: 리드 정보
8. **leadContacts**: 리드의 연락처 정보 (이메일, 전화번호 등)

---

## 🔄 동작 프로세스

### Phase 1: 시퀀스 등록

#### 1단계: 고객 그룹 선택 및 시퀀스 선택
```
사용자 → 고객 그룹 페이지 → "시퀀스에 등록" 버튼 클릭 → 시퀀스 선택 모달
```

#### 2단계: 백엔드 API 호출
```typescript
POST /api/v1/admin/sequences/:sequenceId/enrollments/bulk-with-scheduling

Request Body:
{
  "leadIds": ["lead-id-1", "lead-id-2", ...],
  "userEmailAccountId": "email-account-id",
  "enrolledBy": "user-id" (optional)
}
```

#### 3단계: 백엔드 처리 (sequence.service.ts)

```typescript
bulkEnrollWithScheduling() {
  // 1. 시퀀스 스텝 조회
  const steps = await getSequenceSteps(sequenceId)

  // 2. 이메일이 있는 리드만 필터링
  const leadsWithEmails = await db
    .select(...)
    .from(leads)
    .innerJoin(leadContacts, ...)
    .where(contactType = 'email' AND isPrimary = true)

  // 3. 각 리드에 대해 enrollment 생성
  const enrollments = await db
    .insert(sequenceEnrollments)
    .values([{
      sequenceId,
      leadId,
      userEmailAccountId,
      status: 'active',
      currentStepOrder: 0
    }])

  // 4. 각 enrollment에 대해 모든 스텝의 execution 생성
  for (const enrollment of enrollments) {
    for (const step of steps) {
      const scheduledAt = enrolledAt + (step.delayDays * 24 * 60 * 60 * 1000)

      await db.insert(sequenceStepExecutions).values({
        enrollmentId: enrollment.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: 'pending',
        scheduledAt: scheduledAt
      })
    }
  }

  // 5. enrollment의 nextStepScheduledAt 업데이트
  await db.update(sequenceEnrollments)
    .set({ nextStepScheduledAt: firstStepScheduledAt })
}
```

**생성되는 데이터 예시:**

시퀀스에 3개의 스텝이 있고 (Day 0, Day 3, Day 7), 리드가 2명인 경우:
- `sequenceEnrollments`: 2개 레코드 생성
- `sequenceStepExecutions`: 6개 레코드 생성 (2명 × 3스텝)

```sql
-- sequenceEnrollments
| id | sequenceId | leadId | status  | currentStepOrder | nextStepScheduledAt  |
|----|------------|--------|---------|------------------|----------------------|
| e1 | seq-1      | lead-1 | active  | 0                | 2025-09-30 10:00:00 |
| e2 | seq-1      | lead-2 | active  | 0                | 2025-09-30 10:00:00 |

-- sequenceStepExecutions
| id | enrollmentId | stepId | stepOrder | status  | scheduledAt         |
|----|--------------|--------|-----------|---------|---------------------|
| x1 | e1           | step-1 | 1         | pending | 2025-09-30 10:00:00 |
| x2 | e1           | step-2 | 2         | pending | 2025-10-03 10:00:00 |
| x3 | e1           | step-3 | 3         | pending | 2025-10-07 10:00:00 |
| x4 | e2           | step-1 | 1         | pending | 2025-09-30 10:00:00 |
| x5 | e2           | step-2 | 2         | pending | 2025-10-03 10:00:00 |
| x6 | e2           | step-3 | 3         | pending | 2025-10-07 10:00:00 |
```

---

### Phase 2: 이메일 발송 (Email Sequence Worker)

#### Worker 시작
```typescript
// elysia-server/src/index.ts
import { startEmailSequenceWorker } from './workers/email-sequence-worker'

// 서버 시작 시 워커 실행
startEmailSequenceWorker()
```

#### Worker 동작 주기
```
매 1분마다 실행 → 대기 중인 이메일 확인 → 발송 → 상태 업데이트 → 다음 스텝 스케줄
```

#### 상세 프로세스

```typescript
async function processSequenceEmails() {
  // 1. 발송 대기 중인 execution 조회
  const pending = await getPendingStepExecutions(50)

  // WHERE conditions:
  // - stepExecutions.status = 'pending'
  // - stepExecutions.scheduledAt <= NOW()
  // - enrollments.status = 'active'
  // - sequences.status = 'active'

  for (const execution of pending) {
    // 2. 리드의 primary 이메일 조회
    const leadEmail = await getLeadPrimaryEmail(execution.leadId)

    // 3. 발송자 이메일 계정 조회
    const emailAccount = await getEmailAccount(execution.emailAccountId)

    // 4. SendGrid로 이메일 발송
    const result = await sendEmail({
      to: leadEmail,
      from: emailAccount.emailAddress,
      subject: execution.emailSubject,
      text: execution.emailBodyText,
      html: execution.emailBodyHtml,
      apiKey: emailAccount.sendgridApiKey
    })

    if (result.success) {
      // 5. execution 상태 업데이트 -> 'sent'
      await updateStepExecutionStatus(
        execution.executionId,
        'sent',
        messageId
      )

      // 6. enrollment 진행 상태 업데이트
      await updateEnrollmentProgress(
        execution.enrollmentId,
        execution.stepOrder
      )

      // 이 과정에서:
      // - currentStepOrder 업데이트
      // - firstEmailSentAt 설정 (첫 이메일인 경우)
      // - lastEmailSentAt 업데이트
      // - 마지막 스텝이면 status = 'completed'
      // - 아니면 nextStepScheduledAt 업데이트

    } else {
      // 7. 실패 시 상태 업데이트 -> 'failed'
      await updateStepExecutionStatus(
        execution.executionId,
        'failed',
        errorMessage
      )
    }
  }
}
```

#### 발송 후 상태 변화

```sql
-- 첫 번째 이메일 발송 후
sequenceEnrollments:
| id | currentStepOrder | status  | firstEmailSentAt    | lastEmailSentAt     | nextStepScheduledAt  |
|----|------------------|---------|---------------------|---------------------|----------------------|
| e1 | 1                | active  | 2025-09-30 10:00:00 | 2025-09-30 10:00:00 | 2025-10-03 10:00:00 |

sequenceStepExecutions:
| id | stepOrder | status | scheduledAt         | executedAt          | emailId  |
|----|-----------|--------|---------------------|---------------------|----------|
| x1 | 1         | sent   | 2025-09-30 10:00:00 | 2025-09-30 10:00:05 | msg-123  |
| x2 | 2         | pending| 2025-10-03 10:00:00 | NULL                | NULL     |
| x3 | 3         | pending| 2025-10-07 10:00:00 | NULL                | NULL     |
```

---

## 📊 상태 다이어그램

### Enrollment 상태 흐름
```
pending → active → completed
            ↓
        paused / stopped / bounced / unsubscribed
```

### Step Execution 상태 흐름
```
pending → scheduled → sent
            ↓
          failed / skipped
```

---

## 🔧 주요 API 엔드포인트

### 고객 그룹 → 시퀀스 등록
```http
POST /api/v1/admin/sequences/:sequenceId/enrollments/bulk-with-scheduling
Content-Type: application/json

{
  "leadIds": ["uuid-1", "uuid-2"],
  "userEmailAccountId": "uuid",
  "enrolledBy": "uuid" (optional)
}

Response:
{
  "enrolledCount": 2,
  "totalSteps": 3,
  "scheduledExecutions": 6
}
```

### 고객 그룹 멤버 조회 (이메일 포함)
```http
GET /api/v1/customer-groups/:groupId/members-with-emails

Response:
[
  {
    "leadId": "uuid",
    "companyName": "Company A",
    "websiteUrl": "https://company-a.com",
    "leadStatus": "new"
  }
]
```

### 대기 중인 이메일 조회 (Worker용)
```http
GET /api/v1/admin/sequences/step-executions/pending?limit=100

Response:
{
  "data": [
    {
      "executionId": "uuid",
      "enrollmentId": "uuid",
      "leadId": "uuid",
      "leadCompanyName": "Company A",
      "emailSubject": "Welcome Email",
      "emailBodyText": "...",
      "scheduledAt": "2025-09-30T10:00:00Z",
      ...
    }
  ],
  "count": 5
}
```

### 발송 상태 업데이트 (Worker용)
```http
PATCH /api/v1/admin/sequences/step-executions/:executionId/status
Content-Type: application/json

{
  "status": "sent", // or "failed", "skipped"
  "errorMessage": "..." (optional),
  "emailId": "sendgrid-message-id" (optional)
}
```

---

## 📝 프론트엔드 통합 (예정)

### API Hooks 사용 예시

```typescript
import { useBulkEnrollWithScheduling } from '@/lib/api/hooks/sequences'

function EnrollToSequenceModal() {
  const enrollMutation = useBulkEnrollWithScheduling()

  const handleEnroll = async () => {
    await enrollMutation.mutateAsync({
      sequenceId: selectedSequenceId,
      data: {
        leadIds: selectedLeadIds,
        userEmailAccountId: selectedEmailAccountId,
        enrolledBy: currentUserId
      }
    })
  }

  return (
    <Dialog>
      {/* UI */}
      <Button onClick={handleEnroll}>
        등록하기
      </Button>
    </Dialog>
  )
}
```

---

## 🎯 주요 기능

### ✅ 완료된 기능

1. **백엔드 서비스**
   - ✅ 시퀀스 CRUD
   - ✅ 시퀀스 스텝 관리
   - ✅ 고객 그룹 → 시퀀스 일괄 등록 (스케줄링 포함)
   - ✅ 이메일 발송 워커 (1분 주기)
   - ✅ 발송 상태 추적 및 업데이트
   - ✅ Enrollment 진행 상태 관리

2. **프론트엔드 API 레이어**
   - ✅ TypeScript 타입 정의
   - ✅ API 서비스 함수
   - ✅ React Query Hooks
   - ✅ 자동 캐시 무효화

### 🚧 추후 개발 예정

1. **프론트엔드 UI**
   - ⏳ 시퀀스 등록 모달 컴포넌트
   - ⏳ 고객 그룹 페이지에 "시퀀스에 등록" 버튼
   - ⏳ Enrollments 테이블 (등록 현황 확인)
   - ⏳ 스케줄 미리보기
   - ⏳ 실시간 발송 상태 모니터링

2. **고급 기능**
   - ⏳ 이메일 템플릿 변수 치환 ({{companyName}} 등)
   - ⏳ A/B 테스트 지원
   - ⏳ 발송 시간대 제한 (업무 시간만 발송)
   - ⏳ 반응률 추적 (오픈률, 클릭률)
   - ⏳ 자동 재시도 (실패 시)

---

## 🐛 트러블슈팅

### 이메일이 발송되지 않는 경우

1. **Worker 확인**
   ```bash
   # 서버 로그 확인
   [Email Sequence Worker] Found X pending emails
   ```

2. **데이터베이스 확인**
   ```sql
   -- pending 상태의 execution 조회
   SELECT * FROM sequence_step_executions
   WHERE status = 'pending'
   AND scheduled_at <= NOW();

   -- enrollment 상태 확인
   SELECT * FROM sequence_enrollments
   WHERE status = 'active';
   ```

3. **이메일 계정 확인**
   - SendGrid API Key가 올바른지 확인
   - 이메일 계정이 활성화 상태인지 확인

4. **리드 이메일 확인**
   ```sql
   -- 리드의 primary 이메일 확인
   SELECT * FROM lead_contacts
   WHERE lead_id = 'xxx'
   AND contact_type = 'email'
   AND is_primary = true;
   ```

---

## 📈 모니터링

### 주요 지표

1. **발송 성공률**
   ```sql
   SELECT
     COUNT(CASE WHEN status = 'sent' THEN 1 END) * 100.0 / COUNT(*) as success_rate
   FROM sequence_step_executions
   WHERE executed_at >= NOW() - INTERVAL '1 day';
   ```

2. **평균 발송 지연**
   ```sql
   SELECT AVG(
     EXTRACT(EPOCH FROM (executed_at - scheduled_at))
   ) as avg_delay_seconds
   FROM sequence_step_executions
   WHERE status = 'sent'
   AND executed_at >= NOW() - INTERVAL '1 day';
   ```

3. **활성 Enrollment 수**
   ```sql
   SELECT COUNT(*) FROM sequence_enrollments
   WHERE status = 'active';
   ```

---

## 🔒 보안 고려사항

1. **API Key 관리**
   - SendGrid API Key는 환경변수 또는 DB에 암호화 저장
   - 계정별로 다른 API Key 사용 가능

2. **Rate Limiting**
   - Worker는 한 번에 최대 50개까지만 처리
   - SendGrid의 Rate Limit 준수

3. **개인정보 보호**
   - 이메일 주소 등 개인정보는 GDPR 준수
   - 구독 취소(unsubscribe) 기능 필수

---

## 🔍 각 기능 상세 설명

### 1️⃣ 시퀀스(Sequence) 관리

#### 개념
시퀀스는 여러 단계(Step)로 구성된 이메일 캠페인입니다. 예를 들어 "신규 고객 온보딩" 시퀀스는 다음과 같이 구성될 수 있습니다:
- Day 0: 환영 이메일
- Day 3: 제품 소개 이메일
- Day 7: 특별 할인 이메일

#### 데이터 구조
```typescript
interface Sequence {
  id: string                    // 시퀀스 고유 ID
  workspaceId: string           // 워크스페이스 ID
  name: string                  // 시퀀스 이름 (예: "신규 고객 온보딩")
  description?: string          // 설명
  status: SequenceStatus        // 'draft' | 'active' | 'paused' | 'archived'
  createdBy?: string            // 생성자 ID
  createdAt: string             // 생성 일시
  updatedAt: string             // 수정 일시
}
```

#### 주요 기능

**1. 시퀀스 생성 (POST /api/v1/sequences)**
```typescript
// Request
{
  "workspaceId": "workspace-uuid",
  "name": "신규 고객 온보딩",
  "description": "신규 가입 고객을 위한 3단계 온보딩 이메일",
  "status": "draft",
  "createdBy": "user-uuid"
}

// Response
{
  "id": "sequence-uuid",
  "workspaceId": "workspace-uuid",
  "name": "신규 고객 온보딩",
  "status": "draft",
  "createdAt": "2025-09-30T10:00:00Z",
  "updatedAt": "2025-09-30T10:00:00Z"
}
```

**2. 시퀀스 상태 관리**
- **draft**: 작성 중 (발송 안 됨)
- **active**: 활성화 (발송 가능)
- **paused**: 일시정지 (새 등록 불가)
- **archived**: 보관 (사용 안 함)

**3. 시퀀스 조회 및 필터링**
```typescript
// GET /api/v1/sequences/search
// 파라미터:
// - status: 상태 필터
// - search: 이름/설명 검색
// - workspaceIds: 워크스페이스 필터
// - page, limit: 페이징

// Response
{
  "data": [
    {
      "id": "seq-1",
      "name": "신규 고객 온보딩",
      "status": "active",
      "workspaceName": "회사A",
      "stepsCount": 3,          // 스텝 개수
      "enrollmentsCount": 150   // 등록된 리드 수
    }
  ],
  "total": 10,
  "limit": 10,
  "offset": 0
}
```

---

### 2️⃣ 시퀀스 스텝(Sequence Step) 관리

#### 개념
시퀀스 스텝은 시퀀스 내의 각 이메일 단계를 나타냅니다. 각 스텝은 순서, 지연 시간, 이메일 내용을 가집니다.

#### 데이터 구조
```typescript
interface SequenceStep {
  id: string                  // 스텝 고유 ID
  sequenceId: string          // 소속 시퀀스 ID
  stepOrder: number           // 순서 (1, 2, 3...)
  delayDays: number           // 이전 스텝으로부터 지연 일수
  emailSubject: string        // 이메일 제목
  emailBodyText?: string      // 텍스트 본문
  emailBodyHtml?: string      // HTML 본문
  emailTemplateId?: string    // 템플릿 ID (선택사항)
  createdAt: string
  updatedAt: string
}
```

#### 주요 기능

**1. 스텝 생성 (POST /api/v1/sequences/:id/steps)**
```typescript
// Request
{
  "stepOrder": 1,
  "delayDays": 0,           // Day 0 (즉시)
  "emailSubject": "환영합니다! {{companyName}}에 오신 것을 환영합니다",
  "emailBodyText": "안녕하세요...",
  "emailBodyHtml": "<html>...</html>"
}

// 두 번째 스텝
{
  "stepOrder": 2,
  "delayDays": 3,           // Day 3 (3일 후)
  "emailSubject": "제품 소개",
  "emailBodyText": "...",
  "emailBodyHtml": "..."
}

// 세 번째 스텝
{
  "stepOrder": 3,
  "delayDays": 7,           // Day 7 (7일 후)
  "emailSubject": "특별 할인 제공",
  "emailBodyText": "...",
  "emailBodyHtml": "..."
}
```

**2. 스텝 순서 및 지연 시간**
- `stepOrder`: 스텝의 실행 순서 (1부터 시작)
- `delayDays`: **등록 시점(enrolledAt)으로부터** 며칠 후 발송할지 결정
  - Step 1 (delayDays: 0) → 등록 즉시
  - Step 2 (delayDays: 3) → 등록 후 3일
  - Step 3 (delayDays: 7) → 등록 후 7일

**3. 스텝 조회 (GET /api/v1/sequences/:id/steps)**
```typescript
// Response
[
  {
    "id": "step-1",
    "sequenceId": "seq-1",
    "stepOrder": 1,
    "delayDays": 0,
    "emailSubject": "환영합니다!",
    "createdAt": "..."
  },
  {
    "id": "step-2",
    "sequenceId": "seq-1",
    "stepOrder": 2,
    "delayDays": 3,
    "emailSubject": "제품 소개",
    "createdAt": "..."
  }
]
```

**4. 스텝 수정 및 삭제**
- **PUT** `/api/v1/sequences/:id/steps/:stepId`: 스텝 수정
- **DELETE** `/api/v1/sequences/:id/steps/:stepId`: 스텝 삭제

---

### 3️⃣ 시퀀스 등록(Enrollment)

#### 개념
Enrollment는 특정 리드를 시퀀스에 등록하는 것을 의미합니다. 등록되면 해당 리드는 시퀀스의 모든 스텝을 거치게 됩니다.

#### 데이터 구조
```typescript
interface SequenceEnrollment {
  id: string                      // 등록 고유 ID
  sequenceId: string              // 시퀀스 ID
  leadId: string                  // 리드 ID
  userEmailAccountId: string      // 발송자 이메일 계정 ID
  currentStepOrder: number        // 현재 진행 중인 스텝 (0: 시작 전, 1: 첫 스텝 완료...)
  status: EnrollmentStatus        // 등록 상태
  enrolledBy?: string             // 등록자 ID
  enrolledAt: string              // 등록 일시
  firstEmailSentAt?: string       // 첫 이메일 발송 일시
  lastEmailSentAt?: string        // 마지막 이메일 발송 일시
  completedAt?: string            // 완료 일시
  stoppedAt?: string              // 중지 일시
  nextStepScheduledAt?: string    // 다음 스텝 발송 예정 일시
}

type EnrollmentStatus =
  | 'active'        // 진행 중
  | 'paused'        // 일시정지
  | 'completed'     // 완료 (모든 스텝 발송 완료)
  | 'stopped'       // 중지됨
  | 'bounced'       // 반송됨 (이메일 전달 실패)
  | 'unsubscribed'  // 구독 취소
```

#### 주요 기능

**1. 개별 등록 (POST /api/v1/sequences/:id/enrollments)**
```typescript
// Request
{
  "leadId": "lead-uuid",
  "userEmailAccountId": "email-account-uuid",
  "enrolledBy": "user-uuid"
}

// Response
{
  "id": "enrollment-uuid",
  "sequenceId": "seq-uuid",
  "leadId": "lead-uuid",
  "status": "active",
  "currentStepOrder": 0,
  "enrolledAt": "2025-09-30T10:00:00Z"
}
```

**2. 일괄 등록 with 스케줄링 (핵심 기능!)**
```typescript
// POST /api/v1/admin/sequences/:id/enrollments/bulk-with-scheduling

// Request
{
  "leadIds": ["lead-1", "lead-2", "lead-3"],
  "userEmailAccountId": "email-account-uuid",
  "enrolledBy": "user-uuid"
}

// Response
{
  "enrolledCount": 3,           // 등록된 리드 수
  "totalSteps": 3,              // 시퀀스의 총 스텝 수
  "scheduledExecutions": 9      // 생성된 실행 스케줄 수 (3명 × 3스텝)
}
```

**처리 과정:**
1. 요청받은 리드 ID들 중 **primary 이메일이 있는 리드만** 필터링
2. 각 리드에 대해 `sequenceEnrollments` 레코드 생성
3. 각 enrollment에 대해 **모든 스텝의 실행 스케줄** 생성
4. 첫 번째 스텝의 발송 예정 시간을 `nextStepScheduledAt`에 설정

**3. 등록 현황 조회 (GET /api/v1/sequences/:id/enrollments)**
```typescript
// Response
{
  "data": [
    {
      "id": "enrollment-1",
      "leadId": "lead-1",
      "status": "active",
      "currentStepOrder": 1,              // 첫 번째 스텝 완료
      "enrolledAt": "2025-09-30T10:00:00Z",
      "firstEmailSentAt": "2025-09-30T10:05:00Z",
      "lastEmailSentAt": "2025-09-30T10:05:00Z",
      "nextStepScheduledAt": "2025-10-03T10:00:00Z",  // 3일 후
      "leadCompanyName": "Company A",
      "emailAccountAddress": "sales@company.com"
    }
  ],
  "total": 150,
  "limit": 10,
  "offset": 0
}
```

**4. 등록 상태 변경 (PATCH /api/v1/sequences/:id/enrollments/:enrollmentId/status)**
```typescript
// Request
{
  "status": "paused"  // 'active' | 'paused' | 'stopped' | 'completed' | 'bounced' | 'unsubscribed'
}

// 사용 예시:
// - paused: 일시적으로 이메일 발송 중단
// - stopped: 사용자가 직접 중단 (더 이상 발송 안 함)
// - unsubscribed: 수신 거부 처리
```

---

### 4️⃣ 스텝 실행(Step Execution)

#### 개념
Step Execution은 특정 enrollment의 특정 스텝에 대한 **실제 이메일 발송 작업**을 나타냅니다. 등록 시점에 모든 스텝의 execution이 미리 생성되며, 각각의 발송 예정 시간(`scheduledAt`)이 설정됩니다.

#### 데이터 구조
```typescript
interface SequenceStepExecution {
  id: string                    // 실행 고유 ID
  enrollmentId: string          // 소속 enrollment ID
  stepId: string                // 실행할 스텝 ID
  stepOrder: number             // 스텝 순서
  status: StepExecutionStatus   // 실행 상태
  scheduledAt: string           // 발송 예정 일시
  executedAt?: string           // 실제 발송 일시
  errorMessage?: string         // 에러 메시지 (실패 시)
  emailId?: string              // SendGrid 메시지 ID (성공 시)
  createdAt: string
}

type StepExecutionStatus =
  | 'pending'     // 대기 중
  | 'scheduled'   // 스케줄됨
  | 'sent'        // 발송 완료
  | 'failed'      // 발송 실패
  | 'skipped'     // 건너뜀
```

#### 생성 타이밍 및 스케줄 계산

**등록 시점에 모든 스텝의 execution이 생성됩니다:**

```typescript
// 등록 시간: 2025-09-30 10:00:00
// Step 1: delayDays = 0
// Step 2: delayDays = 3
// Step 3: delayDays = 7

// 생성되는 executions:
[
  {
    enrollmentId: "enr-1",
    stepId: "step-1",
    stepOrder: 1,
    status: "pending",
    scheduledAt: "2025-09-30 10:00:00"  // enrolledAt + 0일
  },
  {
    enrollmentId: "enr-1",
    stepId: "step-2",
    stepOrder: 2,
    status: "pending",
    scheduledAt: "2025-10-03 10:00:00"  // enrolledAt + 3일
  },
  {
    enrollmentId: "enr-1",
    stepId: "step-3",
    stepOrder: 3,
    status: "pending",
    scheduledAt: "2025-10-07 10:00:00"  // enrolledAt + 7일
  }
]
```

#### Worker의 Execution 처리

**1. 대기 중인 execution 조회**
```sql
SELECT * FROM sequence_step_executions
WHERE status = 'pending'
  AND scheduled_at <= NOW()
  AND enrollment.status = 'active'
  AND sequence.status = 'active'
ORDER BY scheduled_at ASC
LIMIT 50;
```

**2. 이메일 발송 및 상태 업데이트**
```typescript
// Worker 로직
for (const execution of pendingExecutions) {
  // 리드의 primary 이메일 조회
  const leadEmail = await getLeadPrimaryEmail(execution.leadId)

  // 발송자 이메일 계정 조회
  const emailAccount = await getEmailAccount(execution.emailAccountId)

  // SendGrid로 이메일 발송
  const result = await sendEmail({
    to: leadEmail,
    from: emailAccount.emailAddress,
    subject: execution.emailSubject,
    text: execution.emailBodyText,
    html: execution.emailBodyHtml,
    apiKey: emailAccount.sendgridApiKey
  })

  if (result.success) {
    // 성공: status = 'sent', emailId 저장
    await updateStepExecutionStatus(
      execution.executionId,
      'sent',
      undefined,
      result.messageId  // SendGrid 메시지 ID
    )

    // Enrollment 진행 상태 업데이트
    await updateEnrollmentProgress(
      execution.enrollmentId,
      execution.stepOrder
    )
  } else {
    // 실패: status = 'failed', errorMessage 저장
    await updateStepExecutionStatus(
      execution.executionId,
      'failed',
      result.error
    )
  }
}
```

**3. 발송 후 상태 변화**
```typescript
// 발송 전
{
  "id": "exec-1",
  "status": "pending",
  "scheduledAt": "2025-09-30T10:00:00Z",
  "executedAt": null,
  "emailId": null
}

// 발송 후 (성공)
{
  "id": "exec-1",
  "status": "sent",
  "scheduledAt": "2025-09-30T10:00:00Z",
  "executedAt": "2025-09-30T10:00:05Z",  // 실제 발송 시간
  "emailId": "sendgrid-message-id"       // SendGrid 메시지 ID
}

// 발송 후 (실패)
{
  "id": "exec-1",
  "status": "failed",
  "scheduledAt": "2025-09-30T10:00:00Z",
  "executedAt": "2025-09-30T10:00:05Z",
  "errorMessage": "Invalid email address"
}
```

---

### 5️⃣ 이메일 발송 워커(Email Sequence Worker)

#### 개념
백그라운드에서 주기적으로 실행되는 자동화 프로세스로, 발송 시간이 된 이메일을 자동으로 발송합니다.

#### 실행 주기
- **1분마다** 자동 실행
- 서버 시작 시 자동으로 시작됨
- `startEmailSequenceWorker()` 함수 호출

#### 워커 동작 흐름

```typescript
// 1분마다 실행
setInterval(async () => {
  console.log('[Email Sequence Worker] Starting email processing...')

  // 1. 발송 대기 중인 executions 조회 (최대 50개)
  const pending = await getPendingStepExecutions(50)

  if (pending.length === 0) {
    console.log('[Email Sequence Worker] No pending emails to send')
    return
  }

  console.log(`[Email Sequence Worker] Found ${pending.length} pending emails`)

  // 2. 각 execution 처리
  for (const execution of pending) {
    console.log(
      `[Email Sequence Worker] Processing execution ${execution.executionId} ` +
      `for lead ${execution.leadCompanyName || execution.leadId}`
    )

    // 3. 이메일 발송
    const result = await sendSequenceEmail(execution)

    if (result.success) {
      // 4-1. 성공: execution 상태 업데이트
      await updateStepExecutionStatus(
        execution.executionId,
        'sent',
        undefined,
        result.messageId
      )

      // 4-2. enrollment 진행 상태 업데이트
      await updateEnrollmentProgress(
        execution.enrollmentId,
        execution.stepOrder
      )

      console.log(`[Email Sequence Worker] ✓ Email sent successfully: ${result.messageId}`)
    } else {
      // 5. 실패: execution 상태 업데이트
      await updateStepExecutionStatus(
        execution.executionId,
        'failed',
        result.error
      )

      console.error(`[Email Sequence Worker] ✗ Email failed: ${result.error}`)
    }
  }

  console.log('[Email Sequence Worker] Finished processing emails')
}, 60 * 1000)  // 60초
```

#### 이메일 발송 로직

```typescript
async function sendSequenceEmail(execution) {
  try {
    // 1. 리드의 primary 이메일 조회
    const [leadContact] = await db
      .select({ email: leadContacts.contactValue })
      .from(leadContacts)
      .where(
        eq(leadContacts.leadId, execution.leadId),
        eq(leadContacts.contactType, 'email'),
        eq(leadContacts.isPrimary, true)
      )
      .limit(1)

    if (!leadContact) {
      return { success: false, error: 'Lead email not found' }
    }

    // 2. 발송자 이메일 계정 조회
    const [emailAccount] = await db
      .select({
        emailAddress: userEmailAccounts.emailAddress,
        displayName: userEmailAccounts.displayName,
        sendgridApiKey: userEmailAccounts.sendgridApiKey
      })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.id, execution.emailAccountId))
      .limit(1)

    if (!emailAccount) {
      return { success: false, error: 'Email account not found' }
    }

    // 3. SendGrid API Key 설정
    const apiKey = emailAccount.sendgridApiKey || config.sendgrid.apiKey
    if (!apiKey) {
      return { success: false, error: 'SendGrid API key not configured' }
    }
    sgMail.setApiKey(apiKey)

    // 4. 이메일 메시지 구성
    const msg = {
      to: leadContact.email,
      from: {
        email: emailAccount.emailAddress,
        name: emailAccount.displayName || emailAccount.emailAddress
      },
      subject: execution.emailSubject,
      text: execution.emailBodyText,
      html: execution.emailBodyHtml
    }

    // 5. SendGrid로 이메일 발송
    const [response] = await sgMail.send(msg)

    return {
      success: true,
      messageId: response.headers['x-message-id']
    }
  } catch (error) {
    console.error('Error sending sequence email:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}
```

#### Enrollment 진행 상태 업데이트

```typescript
async function updateEnrollmentProgress(enrollmentId, stepOrder) {
  // 1. 현재 enrollment 정보 조회
  const enrollment = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      currentStepOrder: sequenceEnrollments.currentStepOrder
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  // 2. 시퀀스의 모든 스텝 조회
  const steps = await getSequenceSteps(enrollment.sequenceId)
  const isLastStep = stepOrder >= steps.length

  // 3. 업데이트할 데이터 준비
  const updateData = {
    currentStepOrder: stepOrder,        // 현재 스텝 업데이트
    lastEmailSentAt: new Date()         // 마지막 발송 시간 업데이트
  }

  // 4. 첫 이메일 발송 시간 설정 (한 번만)
  const enr = await db
    .select({ firstEmailSentAt: sequenceEnrollments.firstEmailSentAt })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (!enr[0]?.firstEmailSentAt) {
    updateData.firstEmailSentAt = new Date()
  }

  // 5. 마지막 스텝이면 완료 처리
  if (isLastStep) {
    updateData.status = 'completed'
    updateData.completedAt = new Date()
    updateData.nextStepScheduledAt = null
  } else {
    // 6. 다음 스텝 스케줄 설정
    const nextStep = steps.find(s => s.stepOrder === stepOrder + 1)
    if (nextStep) {
      const nextScheduledAt = new Date(Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000)
      updateData.nextStepScheduledAt = nextScheduledAt
    }
  }

  // 7. enrollment 업데이트
  await db
    .update(sequenceEnrollments)
    .set(updateData)
    .where(eq(sequenceEnrollments.id, enrollmentId))
}
```

#### 워커 로그 예시

```
[Email Sequence Worker] Starting worker...
[Email Sequence Worker] Starting email processing...
[Email Sequence Worker] Found 5 pending emails
[Email Sequence Worker] Processing execution exec-1 for lead Company A
[Email Sequence Worker] ✓ Email sent successfully: sendgrid-msg-123
[Email Sequence Worker] Processing execution exec-2 for lead Company B
[Email Sequence Worker] ✓ Email sent successfully: sendgrid-msg-124
[Email Sequence Worker] Processing execution exec-3 for lead Company C
[Email Sequence Worker] ✗ Email failed: Invalid email address
[Email Sequence Worker] Finished processing emails

# 1분 후...
[Email Sequence Worker] Starting email processing...
[Email Sequence Worker] No pending emails to send
```

---

### 6️⃣ 고객 그룹 → 시퀀스 등록 플로우

#### 전체 플로우

```
┌─────────────────────┐
│ 1. 고객 그룹 선택    │
│    (프론트엔드)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. 시퀀스 선택       │
│    이메일 계정 선택  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ 3. API 호출                                  │
│    POST /api/v1/admin/sequences/:id/        │
│         enrollments/bulk-with-scheduling    │
│                                              │
│    Body: {                                  │
│      leadIds: [리드ID 배열],               │
│      userEmailAccountId: "계정ID",         │
│      enrolledBy: "사용자ID"                │
│    }                                         │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ 4. 백엔드 처리 (bulkEnrollWithScheduling)   │
│                                              │
│    4-1. 시퀀스 스텝 조회                     │
│         - Step 1: Day 0                     │
│         - Step 2: Day 3                     │
│         - Step 3: Day 7                     │
│                                              │
│    4-2. 이메일 있는 리드만 필터링            │
│         SELECT leads.* FROM leads           │
│         INNER JOIN lead_contacts            │
│         WHERE contact_type = 'email'        │
│           AND is_primary = true             │
│                                              │
│    4-3. Enrollments 생성                    │
│         INSERT INTO sequence_enrollments    │
│         (lead-1, lead-2, lead-3...)        │
│                                              │
│    4-4. Step Executions 생성 (중요!)        │
│         각 리드 × 각 스텝 = 실행 스케줄     │
│                                              │
│         Lead 1:                             │
│           - Step 1: 2025-09-30 10:00       │
│           - Step 2: 2025-10-03 10:00       │
│           - Step 3: 2025-10-07 10:00       │
│                                              │
│         Lead 2:                             │
│           - Step 1: 2025-09-30 10:00       │
│           - Step 2: 2025-10-03 10:00       │
│           - Step 3: 2025-10-07 10:00       │
│                                              │
│    4-5. nextStepScheduledAt 설정            │
│         각 enrollment의 첫 스텝 시간 설정   │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ 5. 응답 반환                                 │
│    {                                         │
│      enrolledCount: 2,                      │
│      totalSteps: 3,                         │
│      scheduledExecutions: 6  (2명 × 3스텝) │
│    }                                         │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ 6. 워커가 자동 발송 (1분마다)               │
│                                              │
│    매분 실행:                                │
│    - scheduledAt <= NOW() 조회              │
│    - SendGrid로 이메일 발송                 │
│    - 상태 업데이트 (sent/failed)            │
│    - Enrollment 진행도 업데이트             │
│    - 다음 스텝 스케줄 설정                  │
└─────────────────────────────────────────────┘
```

#### 구체적인 데이터 흐름 예시

**시나리오: 2명의 리드를 3단계 시퀀스에 등록**

1. **시퀀스 정보**
```typescript
{
  id: "seq-1",
  name: "신규 고객 온보딩",
  status: "active",
  steps: [
    { stepOrder: 1, delayDays: 0, subject: "환영 이메일" },
    { stepOrder: 2, delayDays: 3, subject: "제품 소개" },
    { stepOrder: 3, delayDays: 7, subject: "특별 할인" }
  ]
}
```

2. **등록 요청**
```typescript
POST /api/v1/admin/sequences/seq-1/enrollments/bulk-with-scheduling
{
  "leadIds": ["lead-1", "lead-2"],
  "userEmailAccountId": "email-account-1",
  "enrolledBy": "user-1"
}
```

3. **생성되는 Enrollments (2개)**
```sql
INSERT INTO sequence_enrollments VALUES
('enr-1', 'seq-1', 'lead-1', 'email-account-1', 0, 'active', '2025-09-30 10:00:00'),
('enr-2', 'seq-1', 'lead-2', 'email-account-1', 0, 'active', '2025-09-30 10:00:00');
```

4. **생성되는 Step Executions (6개 = 2명 × 3스텝)**
```sql
INSERT INTO sequence_step_executions VALUES
-- Lead 1
('exec-1', 'enr-1', 'step-1', 1, 'pending', '2025-09-30 10:00:00'),  -- Day 0
('exec-2', 'enr-1', 'step-2', 2, 'pending', '2025-10-03 10:00:00'),  -- Day 3
('exec-3', 'enr-1', 'step-3', 3, 'pending', '2025-10-07 10:00:00'),  -- Day 7

-- Lead 2
('exec-4', 'enr-2', 'step-1', 1, 'pending', '2025-09-30 10:00:00'),  -- Day 0
('exec-5', 'enr-2', 'step-2', 2, 'pending', '2025-10-03 10:00:00'),  -- Day 3
('exec-6', 'enr-2', 'step-3', 3, 'pending', '2025-10-07 10:00:00');  -- Day 7
```

5. **워커 동작 (2025-09-30 10:01)**
```typescript
// 대기 중인 execution 조회
SELECT * FROM sequence_step_executions
WHERE status = 'pending'
  AND scheduled_at <= '2025-09-30 10:01:00'
// → exec-1, exec-4 (2개 조회됨)

// exec-1 발송
sendEmail({
  to: 'lead1@company.com',
  from: 'sales@mycompany.com',
  subject: '환영 이메일',
  ...
})
// → 성공

// exec-1 상태 업데이트
UPDATE sequence_step_executions
SET status = 'sent', executed_at = '2025-09-30 10:01:05', email_id = 'msg-123'
WHERE id = 'exec-1';

// enr-1 진행도 업데이트
UPDATE sequence_enrollments
SET current_step_order = 1,
    first_email_sent_at = '2025-09-30 10:01:05',
    last_email_sent_at = '2025-09-30 10:01:05',
    next_step_scheduled_at = '2025-10-03 10:00:00'  -- 다음 스텝 시간
WHERE id = 'enr-1';

// exec-4도 동일하게 처리...
```

6. **3일 후 (2025-10-03 10:01)**
```typescript
// 대기 중인 execution 조회
SELECT * FROM sequence_step_executions
WHERE status = 'pending'
  AND scheduled_at <= '2025-10-03 10:01:00'
// → exec-2, exec-5 (2개 조회됨)

// 두 번째 이메일 발송 및 상태 업데이트...
```

7. **7일 후 (2025-10-07 10:01)**
```typescript
// 마지막 스텝 발송
// → exec-3, exec-6 발송

// Enrollment 완료 처리
UPDATE sequence_enrollments
SET status = 'completed',
    current_step_order = 3,
    completed_at = '2025-10-07 10:01:05',
    next_step_scheduled_at = NULL
WHERE id IN ('enr-1', 'enr-2');
```

---

### 7️⃣ 상태 추적 및 모니터링

#### Enrollment 상태 확인

```sql
-- 활성 enrollment 수
SELECT COUNT(*) FROM sequence_enrollments
WHERE status = 'active';

-- 시퀀스별 진행 현황
SELECT
  s.name as sequence_name,
  se.status,
  COUNT(*) as count
FROM sequence_enrollments se
JOIN sequences s ON se.sequence_id = s.id
GROUP BY s.name, se.status;

-- 특정 리드의 시퀀스 진행 상태
SELECT
  s.name,
  se.current_step_order,
  se.status,
  se.enrolled_at,
  se.next_step_scheduled_at,
  (SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = s.id) as total_steps
FROM sequence_enrollments se
JOIN sequences s ON se.sequence_id = s.id
WHERE se.lead_id = 'lead-uuid';
```

#### Step Execution 상태 확인

```sql
-- 발송 대기 중인 이메일
SELECT
  sse.id,
  l.company_name,
  ss.email_subject,
  sse.scheduled_at,
  sse.status
FROM sequence_step_executions sse
JOIN sequence_enrollments se ON sse.enrollment_id = se.id
JOIN leads l ON se.lead_id = l.id
JOIN sequence_steps ss ON sse.step_id = ss.id
WHERE sse.status = 'pending'
  AND sse.scheduled_at <= NOW()
ORDER BY sse.scheduled_at;

-- 발송 성공률 (최근 24시간)
SELECT
  COUNT(CASE WHEN status = 'sent' THEN 1 END) * 100.0 / COUNT(*) as success_rate,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  COUNT(*) as total_count
FROM sequence_step_executions
WHERE executed_at >= NOW() - INTERVAL '1 day';

-- 평균 발송 지연 (스케줄 시간 vs 실제 발송 시간)
SELECT
  AVG(EXTRACT(EPOCH FROM (executed_at - scheduled_at))) as avg_delay_seconds
FROM sequence_step_executions
WHERE status = 'sent'
  AND executed_at >= NOW() - INTERVAL '1 day';
```

#### 실시간 모니터링 쿼리

```sql
-- 현재 대기 중인 작업 수
SELECT COUNT(*) as pending_count
FROM sequence_step_executions
WHERE status = 'pending'
  AND scheduled_at <= NOW();

-- 다음 1시간 내 발송 예정 이메일
SELECT COUNT(*) as upcoming_count
FROM sequence_step_executions
WHERE status = 'pending'
  AND scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour';

-- 최근 발송된 이메일 (최근 10개)
SELECT
  l.company_name,
  ss.email_subject,
  sse.executed_at,
  sse.status,
  sse.email_id
FROM sequence_step_executions sse
JOIN sequence_enrollments se ON sse.enrollment_id = se.id
JOIN leads l ON se.lead_id = l.id
JOIN sequence_steps ss ON sse.step_id = ss.id
WHERE sse.executed_at IS NOT NULL
ORDER BY sse.executed_at DESC
LIMIT 10;
```

---

## 📚 참고 자료

- **DB Schema**: `/elysia-server/src/db/schema/sequences.ts`
- **Worker 코드**: `/elysia-server/src/workers/email-sequence-worker.ts`
- **서비스 로직**: `/elysia-server/src/services/sequence.service.ts`
- **API Routes**: `/elysia-server/src/routes/sequences.routes.ts`
- **Frontend Hooks**: `/admin/src/lib/api/hooks/sequences.ts`

---

## 🎉 결론

이 시스템은 고객 그룹에 대한 자동화된 이메일 시퀀스 발송을 지원합니다. 한 번 등록하면, 설정된 스케줄에 따라 자동으로 이메일이 발송되며, 각 단계의 진행 상태를 추적할 수 있습니다.

**핵심 흐름**: 고객 그룹 선택 → 시퀀스 등록 → 스케줄 생성 → Worker가 자동 발송 → 상태 업데이트 → 다음 스텝으로 진행