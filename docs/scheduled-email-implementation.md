# 스케줄 이메일 발송 시스템 구현 가이드

## 📋 목차
1. [현재 상태 분석](#현재-상태-분석)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [구현 단계](#구현-단계)
4. [코드 구현](#코드-구현)
5. [테스트 방법](#테스트-방법)
6. [운영 고려사항](#운영-고려사항)

---

## 현재 상태 분석

### ✅ 이미 구현된 것
- **DB 스키마**: `emails` 테이블에 `scheduledAt` 컬럼 및 인덱스 존재
- **프론트엔드**: 스케줄 발송 UI 완성 (`admin/src/pages/email-send-test/index.tsx`)
- **API 엔드포인트**: `/api/v1/emails/send` 엔드포인트 존재
- **시퀀스 워커**: `email-sequence-worker.ts` 참고 가능한 워커 패턴

### ❌ 구현 필요한 것
- **스케줄 등록 로직**: 현재 mock 응답만 반환 (실제 DB 저장 안 함)
- **스케줄 워커**: 예약된 이메일을 처리할 백그라운드 워커
- **상태 관리**: `scheduled` → `queued` → `sent` 상태 전환
- **에러 핸들링**: 재시도 로직 및 실패 처리

---

## 시스템 아키텍처

```
┌─────────────────┐
│   Frontend      │
│  (Admin UI)     │
└────────┬────────┘
         │ POST /api/v1/emails/send
         │ { scheduledAt: "2025-10-01T15:00:00Z" }
         ↓
┌─────────────────────────────────────┐
│   Backend API                       │
│   (elysia-server/routes/emails.ts) │
└────────┬────────────────────────────┘
         │ 1. Validate request
         │ 2. Insert into DB with status='scheduled'
         ↓
┌─────────────────────────────────────┐
│   PostgreSQL Database               │
│   emails table                      │
│   - status: 'scheduled'             │
│   - scheduledAt: timestamp          │
└────────┬────────────────────────────┘
         │ Polling every 30 seconds
         ↓
┌─────────────────────────────────────┐
│   Scheduled Email Worker            │
│   (workers/scheduled-email-worker)  │
│   - Query emails where:             │
│     * status = 'scheduled'          │
│     * scheduledAt <= NOW()          │
│   - Send via SendGrid               │
│   - Update status to 'sent'         │
└─────────────────────────────────────┘
```

---

## 구현 단계

### Phase 1: 스케줄 등록 기능 (Backend API 수정)
1. `/api/v1/emails/send` 엔드포인트에서 `scheduledAt` 처리 로직 추가
2. DB에 이메일 레코드 저장 (`status: 'scheduled'`)
3. 응답 형식 표준화

### Phase 2: 스케줄 워커 구현
1. `scheduled-email-worker.ts` 파일 생성
2. 주기적으로 예약된 이메일 조회
3. SendGrid API로 발송
4. 상태 업데이트 및 에러 처리

### Phase 3: 워커 통합
1. `index.ts`에서 워커 시작
2. 환경변수 설정
3. 로깅 및 모니터링

### Phase 4: 테스트 및 검증
1. 단위 테스트
2. 통합 테스트
3. 부하 테스트

---

## 코드 구현

### 1. Backend API 수정

**파일**: `/elysia-server/src/routes/emails.routes.ts`

기존 라인 94-108을 다음과 같이 수정:

```typescript
// If scheduled, save to database
if (body.scheduledAt) {
  console.log('⏰ Scheduling email for:', body.scheduledAt)

  try {
    // Insert into database with 'scheduled' status
    const [newEmail] = await db
      .insert(emails)
      .values({
        workspaceId: 'test-workspace', // TODO: 실제 workspace ID 사용
        userEmailAccountId: 'test-account', // TODO: 실제 account ID 사용
        direction: 'outbound',
        fromEmail: fixedFromEmail,
        toEmail: body.toEmail,
        subject: body.subject,
        bodyText: body.bodyText || null,
        bodyHtml: body.bodyHtml || null,
        ccEmails: body.ccEmails || null,
        bccEmails: body.bccEmails || null,
        status: 'scheduled',
        scheduledAt: new Date(body.scheduledAt),
        leadId: body.leadId || null,
        sequenceId: body.sequenceId || null,
        stepId: body.stepId || null,
      })
      .returning()

    console.log('✅ Email scheduled successfully:', newEmail.id)

    return {
      success: true,
      email: newEmail,
      message: '이메일이 예약되었습니다.',
    }
  } catch (error: any) {
    console.error('❌ Failed to schedule email:', error)
    throw new Error('이메일 예약 중 오류가 발생했습니다.')
  }
}
```

**필요한 import 추가**:
```typescript
import { emails } from '../db/schema/emails'
import { db } from '../db/index'
```

### 2. Scheduled Email Worker 생성

**파일**: `/elysia-server/src/workers/scheduled-email-worker.ts` (신규 생성)

```typescript
/**
 * Scheduled Email Worker
 *
 * This worker runs periodically to process scheduled emails.
 * It fetches emails where scheduledAt <= now and status = 'scheduled',
 * sends them via SendGrid, and updates their status.
 */

import sgMail from '@sendgrid/mail'
import { and, eq, lte } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db/index'
import { emails } from '../db/schema/emails'

// Initialize SendGrid
if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey)
}

interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a single email via SendGrid
 */
async function sendScheduledEmail(email: {
  id: string
  fromEmail: string
  toEmail: string
  ccEmails: string[] | null
  bccEmails: string[] | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
}): Promise<EmailSendResult> {
  try {
    // Prepare email message
    const msg: any = {
      to: email.toEmail,
      from: {
        email: email.fromEmail,
        name: config.sendgrid.fromName,
      },
      subject: email.subject || '(제목 없음)',
    }

    // Add CC/BCC if present
    if (email.ccEmails && email.ccEmails.length > 0) {
      msg.cc = email.ccEmails
    }
    if (email.bccEmails && email.bccEmails.length > 0) {
      msg.bcc = email.bccEmails
    }

    // Set body (at least one required)
    if (email.bodyText) {
      msg.text = email.bodyText
    }
    if (email.bodyHtml) {
      msg.html = email.bodyHtml
    }

    // If no body provided, use default
    if (!email.bodyText && !email.bodyHtml) {
      msg.text = '(본문 없음)'
    }

    // Send email
    const [response] = await sgMail.send(msg)

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string,
    }
  } catch (error: any) {
    console.error('[Scheduled Email Worker] SendGrid error:', error.response?.body || error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Process all scheduled emails that are due
 */
async function processScheduledEmails() {
  console.log('[Scheduled Email Worker] Starting scheduled email processing...')

  try {
    const now = new Date()

    // Query emails where:
    // - status = 'scheduled'
    // - scheduledAt <= now
    const scheduledEmails = await db
      .select()
      .from(emails)
      .where(and(eq(emails.status, 'scheduled'), lte(emails.scheduledAt, now)))
      .limit(100) // Process max 100 emails per run

    if (scheduledEmails.length === 0) {
      console.log('[Scheduled Email Worker] No scheduled emails to send')
      return
    }

    console.log(`[Scheduled Email Worker] Found ${scheduledEmails.length} scheduled emails`)

    let successCount = 0
    let failureCount = 0

    // Process each scheduled email
    for (const email of scheduledEmails) {
      console.log(`[Scheduled Email Worker] Processing email ${email.id} to ${email.toEmail}`)

      // Update status to 'queued' to prevent duplicate processing
      await db
        .update(emails)
        .set({ status: 'queued', updatedAt: new Date() })
        .where(eq(emails.id, email.id))

      // Send email
      const result = await sendScheduledEmail(email)

      if (result.success) {
        // Update status to 'sent'
        await db
          .update(emails)
          .set({
            status: 'sent',
            sentAt: new Date(),
            sendgridMessageId: result.messageId,
            updatedAt: new Date(),
          })
          .where(eq(emails.id, email.id))

        successCount++
        console.log(`[Scheduled Email Worker] ✓ Email sent: ${email.id} (${result.messageId})`)
      } else {
        // Update status to 'failed' and increment retry count
        await db
          .update(emails)
          .set({
            status: 'failed',
            errorMessage: result.error,
            retryCount: email.retryCount + 1,
            lastRetryAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emails.id, email.id))

        failureCount++
        console.error(`[Scheduled Email Worker] ✗ Email failed: ${email.id} - ${result.error}`)
      }
    }

    console.log(
      `[Scheduled Email Worker] Finished: ${successCount} sent, ${failureCount} failed (total: ${scheduledEmails.length})`,
    )
  } catch (error) {
    console.error('[Scheduled Email Worker] Error in processScheduledEmails:', error)
  }
}

/**
 * Start the scheduled email worker
 * Runs every 30 seconds to check for due emails
 */
export function startScheduledEmailWorker() {
  console.log('[Scheduled Email Worker] Starting worker...')

  // Run immediately on startup
  processScheduledEmails()

  // Then run every 30 seconds
  const intervalId = setInterval(processScheduledEmails, 30 * 1000) // 30 seconds

  // Return function to stop worker
  return () => {
    console.log('[Scheduled Email Worker] Stopping worker...')
    clearInterval(intervalId)
  }
}

// Export for manual testing
export { processScheduledEmails }
```

### 3. Worker 통합

**파일**: `/elysia-server/src/index.ts`

라인 25 다음에 추가:
```typescript
import { startScheduledEmailWorker } from './workers/scheduled-email-worker'
```

라인 31 다음에 추가:
```typescript
// Start scheduled email worker
startScheduledEmailWorker()
```

최종 결과:
```typescript
// Start email sequence worker
startEmailSequenceWorker()

// Start scheduled email worker
startScheduledEmailWorker()
```

### 4. 환경변수 설정 (선택사항)

**파일**: `/elysia-server/.env`

```env
# Scheduled Email Worker Settings
SCHEDULED_EMAIL_WORKER_INTERVAL=30000  # 30 seconds (in milliseconds)
SCHEDULED_EMAIL_BATCH_SIZE=100         # Max emails per run
```

**파일**: `/elysia-server/src/config/index.ts`

```typescript
export const config = {
  // ... 기존 설정
  scheduledEmailWorker: {
    interval: parseInt(process.env.SCHEDULED_EMAIL_WORKER_INTERVAL || '30000'),
    batchSize: parseInt(process.env.SCHEDULED_EMAIL_BATCH_SIZE || '100'),
  },
}
```

---

## 테스트 방법

### 1. 수동 테스트

#### 1.1 스케줄 이메일 등록
```bash
curl -X POST http://localhost:8000/api/v1/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "toEmail": "test@example.com",
    "subject": "Test Scheduled Email",
    "bodyText": "This is a test scheduled email",
    "scheduledAt": "2025-10-01T15:30:00Z"
  }'
```

#### 1.2 DB 확인
```sql
-- 예약된 이메일 확인
SELECT id, to_email, subject, status, scheduled_at, created_at
FROM emails
WHERE status = 'scheduled'
ORDER BY scheduled_at ASC;

-- 발송된 이메일 확인
SELECT id, to_email, subject, status, scheduled_at, sent_at
FROM emails
WHERE status = 'sent'
ORDER BY sent_at DESC
LIMIT 10;
```

#### 1.3 로그 확인
```bash
# 서버 로그에서 워커 동작 확인
tail -f elysia-server/logs/app.log | grep "Scheduled Email Worker"
```

### 2. 프론트엔드 테스트

1. Admin UI에서 "스케줄 대량 발송" 탭 선택
2. 테스트 이메일 주소 입력 (줄바꿈으로 구분)
3. 예약 시간 설정 (현재 시간 + 1분 후)
4. 제목 및 본문 입력
5. "스케줄 발송 예약" 버튼 클릭
6. 1분 후 이메일 수신 확인

### 3. 부하 테스트

```bash
# 100개의 스케줄 이메일 동시 등록
for i in {1..100}; do
  curl -X POST http://localhost:8000/api/v1/emails/send \
    -H "Content-Type: application/json" \
    -d "{
      \"toEmail\": \"test${i}@example.com\",
      \"subject\": \"Bulk Test ${i}\",
      \"bodyText\": \"Bulk test message ${i}\",
      \"scheduledAt\": \"$(date -u -d '+1 minute' +%Y-%m-%dT%H:%M:%SZ)\"
    }" &
done
wait
```

---

## 운영 고려사항

### 1. 성능 최적화

#### 1.1 인덱스 확인
```sql
-- 이미 존재하는 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'emails' AND indexname = 'emails_scheduled_at_idx';
```

#### 1.2 쿼리 최적화
```typescript
// 복합 인덱스 추가 고려 (status + scheduledAt)
// schema/emails.ts에 추가:
scheduledStatusIdx: index('emails_scheduled_status_idx')
  .on(table.status, table.scheduledAt),
```

### 2. 에러 핸들링 및 재시도 로직

#### 2.1 재시도 제한
```typescript
// scheduled-email-worker.ts에 추가
const MAX_RETRY_COUNT = 3

// 쿼리 조건 수정
.where(
  and(
    eq(emails.status, 'scheduled'),
    lte(emails.scheduledAt, now),
    lt(emails.retryCount, MAX_RETRY_COUNT) // 최대 재시도 횟수 제한
  )
)
```

#### 2.2 지수 백오프 (Exponential Backoff)
```typescript
// 재시도 시간 계산
const retryDelay = Math.min(
  Math.pow(2, email.retryCount) * 60 * 1000, // 1분, 2분, 4분, 8분...
  30 * 60 * 1000 // 최대 30분
)

await db.update(emails)
  .set({
    status: 'scheduled', // 다시 scheduled로 변경
    scheduledAt: new Date(Date.now() + retryDelay),
    retryCount: email.retryCount + 1,
  })
```

### 3. 모니터링 및 알림

#### 3.1 지표 수집
```typescript
// 처리 지표 로깅
interface WorkerMetrics {
  timestamp: Date
  processedCount: number
  successCount: number
  failureCount: number
  averageProcessingTime: number
}

// 로그 또는 모니터링 시스템으로 전송
```

#### 3.2 알림 설정
- 실패율이 50% 이상일 때 알림
- 큐에 1000개 이상 쌓였을 때 알림
- 워커가 5분 이상 응답 없을 때 알림

### 4. 시간대 처리

#### 4.1 서버 시간대 설정
```bash
# Docker 환경
ENV TZ=Asia/Seoul

# 또는 .env 파일
TZ=Asia/Seoul
```

#### 4.2 UTC 저장, 로컬 표시
```typescript
// 항상 UTC로 저장
scheduledAt: new Date(body.scheduledAt) // ISO 8601 UTC

// 프론트엔드에서 로컬 시간으로 표시
const localTime = new Date(email.scheduledAt).toLocaleString('ko-KR', {
  timeZone: 'Asia/Seoul'
})
```

### 5. 스케일링

#### 5.1 워커 다중화
```typescript
// 여러 서버에서 워커 실행 시 중복 방지
// PostgreSQL FOR UPDATE SKIP LOCKED 사용

const scheduledEmails = await db
  .select()
  .from(emails)
  .where(...)
  .limit(100)
  .for('update', { skipLocked: true }) // 이미 처리 중인 레코드 건너뛰기
```

#### 5.2 메시지 큐 사용 (고급)
- Redis Queue (BullMQ)
- AWS SQS
- RabbitMQ

장점:
- 더 나은 동시성 제어
- 실패 시 자동 재시도
- 우선순위 큐 지원

### 6. 로깅 전략

```typescript
// 구조화된 로그 포맷
console.log(JSON.stringify({
  level: 'info',
  component: 'scheduled-email-worker',
  action: 'email_sent',
  emailId: email.id,
  recipient: email.toEmail,
  scheduledAt: email.scheduledAt,
  sentAt: new Date(),
  messageId: result.messageId,
  processingTime: Date.now() - startTime,
}))
```

---

## 체크리스트

### 개발 단계
- [ ] `emails.routes.ts` 수정 (스케줄 등록 로직)
- [ ] `scheduled-email-worker.ts` 생성
- [ ] `index.ts`에 워커 통합
- [ ] 환경변수 설정
- [ ] TypeScript 컴파일 확인

### 테스트 단계
- [ ] 단일 스케줄 이메일 등록 테스트
- [ ] 대량 스케줄 이메일 등록 테스트
- [ ] 워커 동작 확인 (로그)
- [ ] DB 상태 확인 (scheduled → sent)
- [ ] 실제 이메일 수신 확인
- [ ] 에러 케이스 테스트 (잘못된 이메일 주소)

### 운영 단계
- [ ] 모니터링 설정
- [ ] 알림 설정
- [ ] 로그 수집 설정
- [ ] 백업 및 복구 계획
- [ ] 성능 벤치마크
- [ ] 문서화

---

## 참고 자료

### 기존 코드 참고
- **Sequence Worker**: `/elysia-server/src/workers/email-sequence-worker.ts`
- **DB Schema**: `/elysia-server/src/db/schema/emails.ts`
- **SendGrid 설정**: `/elysia-server/src/config/index.ts`

### 관련 문서
- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Node.js Timers](https://nodejs.org/api/timers.html)

### 시간대 관련
- [PostgreSQL Timezone Support](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [JavaScript Date and Time](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)

---

## 마무리

이 가이드를 따라 구현하면:
1. ✅ 프론트엔드에서 스케줄 이메일 등록 가능
2. ✅ 백엔드에서 DB에 저장
3. ✅ 워커가 주기적으로 예약된 이메일 발송
4. ✅ 상태 추적 및 에러 핸들링
5. ✅ 대량 발송 지원

**예상 소요 시간**: 4-6시간 (테스트 포함)

**다음 개선 사항**:
- 메시지 큐 도입 (BullMQ)
- 발송 우선순위 설정
- 발송 속도 제한 (Rate Limiting)
- 상세한 발송 통계 대시보드
