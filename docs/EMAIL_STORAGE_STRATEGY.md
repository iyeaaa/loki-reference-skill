# 이메일 저장 전략: Outbound 발송 및 Inbound Parse 답장 처리

## 개요

이 문서는 SendGrid를 통한 이메일 발송(outbound)과 Inbound Parse를 통한 답장 수신(inbound) 처리 시 데이터베이스 저장 전략을 제안합니다.

## 데이터베이스 테이블 구조

### 1. `emails` 테이블
모든 발송 및 수신 이메일의 기본 정보를 저장하는 메인 테이블

**주요 필드:**
- `direction`: `"outbound"` | `"inbound"`
- `status`: 이메일 상태 (12가지 상태값)
- `messageId`: 표준 이메일 Message-ID 헤더
- `inReplyTo`: 답장 관계를 나타내는 원본 이메일의 Message-ID
- `threadId`: 이메일 스레드 그룹핑용 UUID

### 2. `email_threads` 테이블
이메일 스레드를 관리하는 테이블

**주요 필드:**
- `firstEmailId`: 스레드의 첫 번째 이메일
- `lastEmailId`: 스레드의 마지막 이메일
- `lastActivityAt`: 마지막 활동 시간
- `status`: `"active"` | `"archived"` | `"snoozed"`

### 3. `email_replies` 테이블
답장 이메일에 대한 메타데이터 및 AI 분석 정보를 저장

**주요 필드:**
- `originalEmailId`: 원본 발송 이메일 ID
- `replyEmailId`: 답장 수신 이메일 ID
- `sentiment`: AI 감성 분석 결과
- `intent`: 답장 의도
- `aiSummary`: AI 요약
- `isRead`: 읽음 여부
- `assignedTo`: 담당자 할당

### 4. `email_events` 테이블
SendGrid 웹훅 이벤트를 저장 (delivered, opened, clicked 등)

---

## 저장 전략

### 시나리오 1: 첫 이메일 발송 (Outbound)

#### 1.1 발송 전 (Draft/Scheduled)

```typescript
// emails 테이블에 INSERT
{
  id: uuid(),
  workspaceId: "workspace-uuid",
  userEmailAccountId: "email-account-uuid",
  leadId: "lead-uuid", // 선택적
  sequenceId: "sequence-uuid", // 시퀀스의 경우
  stepId: "step-uuid", // 시퀀스 스텝의 경우

  direction: "outbound",
  fromEmail: "sales@yourcompany.com",
  toEmail: "buyer@client.com",
  subject: "Partnership Proposal",
  bodyText: "...",
  bodyHtml: "...",

  status: "draft", // 또는 "scheduled"
  scheduledAt: "2024-10-06T10:00:00Z", // 예약 발송의 경우

  messageId: null, // 발송 후 생성됨
  sendgridMessageId: null, // 발송 후 생성됨
  threadId: null, // 첫 이메일이므로 null
  inReplyTo: null,

  createdAt: now(),
  updatedAt: now(),
}
```

**동시에 생성할 데이터:**
- `email_threads` 테이블에 새로운 스레드 생성
  ```typescript
  {
    id: "thread-uuid",
    workspaceId: "workspace-uuid",
    leadId: "lead-uuid",
    subject: "Partnership Proposal",
    firstEmailId: null, // 발송 후 업데이트
    lastEmailId: null, // 발송 후 업데이트
    lastActivityAt: null,
    status: "active",
  }
  ```

#### 1.2 발송 성공 시 (Sent)

SendGrid API 응답을 받은 후 업데이트:

```typescript
// emails 테이블 UPDATE
{
  status: "sent",
  sentAt: now(),
  messageId: "<unique-msg-id@yourcompany.com>", // SendGrid가 생성
  sendgridMessageId: "abc123xyz", // SendGrid Message ID
  threadId: "thread-uuid", // 생성된 스레드 ID 연결
}

// email_threads 테이블 UPDATE
{
  firstEmailId: "email-uuid",
  lastEmailId: "email-uuid",
  lastActivityAt: now(),
}
```

#### 1.3 SendGrid 웹훅 이벤트 처리

**Delivered 이벤트:**
```typescript
// emails 테이블 UPDATE
{
  status: "delivered",
  deliveredAt: now(),
}

// email_events 테이블 INSERT
{
  emailId: "email-uuid",
  eventType: "delivered",
  timestamp: now(),
  sendgridEventId: "event-id",
  rawEventData: { /* 전체 웹훅 페이로드 */ },
  processed: true,
}
```

**Opened 이벤트:**
```typescript
// emails 테이블 UPDATE
{
  status: "opened",
  openedAt: now(), // 첫 오픈 시각
  openCount: openCount + 1,
}

// email_events 테이블 INSERT
{
  emailId: "email-uuid",
  eventType: "open",
  timestamp: now(),
  userAgent: "Mozilla/5.0...",
  ipAddress: "192.168.1.1",
  // ...
}
```

**Clicked 이벤트:**
```typescript
// emails 테이블 UPDATE
{
  status: "clicked",
  clickedAt: now(), // 첫 클릭 시각
  clickCount: clickCount + 1,
}

// email_events 테이블 INSERT
{
  emailId: "email-uuid",
  eventType: "click",
  timestamp: now(),
  url: "https://yourcompany.com/proposal",
  userAgent: "...",
  ipAddress: "...",
  // ...
}
```

---

### 시나리오 2: 답장 수신 (Inbound Parse)

#### 2.1 Inbound Parse 웹훅 수신

SendGrid Inbound Parse가 이메일을 수신하면 다음 데이터를 처리합니다:

**파싱할 주요 정보:**
- `headers`: Message-ID, In-Reply-To, References
- `from`: 발신자 이메일
- `to`: 수신자 이메일
- `subject`: 제목
- `text`: 텍스트 본문
- `html`: HTML 본문
- `envelope`: SMTP envelope 정보

#### 2.2 답장 이메일 저장

```typescript
// 1. 원본 이메일 찾기
const inReplyToMessageId = parsedEmail.headers['In-Reply-To']
const originalEmail = await db
  .select()
  .from(emails)
  .where(eq(emails.messageId, inReplyToMessageId))
  .limit(1)

// 2. emails 테이블에 답장 이메일 INSERT
const replyEmail = {
  id: uuid(),
  workspaceId: originalEmail.workspaceId,
  userEmailAccountId: originalEmail.userEmailAccountId,
  leadId: originalEmail.leadId, // 원본 이메일의 lead 연결
  sequenceId: originalEmail.sequenceId, // 원본 이메일의 sequence 연결
  stepId: originalEmail.stepId,

  direction: "inbound", // 수신 이메일
  fromEmail: parsedEmail.from, // "buyer@client.com"
  toEmail: parsedEmail.to, // "sales@yourcompany.com"
  subject: parsedEmail.subject, // "Re: Partnership Proposal"
  bodyText: parsedEmail.text,
  bodyHtml: parsedEmail.html,
  rawEmail: parsedEmail.raw, // RFC 822 전체 원본

  status: "replied", // 답장 상태
  repliedAt: now(),

  messageId: parsedEmail.headers['Message-ID'], // 답장 이메일의 Message-ID
  inReplyTo: inReplyToMessageId, // 원본 이메일의 Message-ID
  threadId: originalEmail.threadId, // 같은 스레드에 연결

  createdAt: now(),
  updatedAt: now(),
}

// 3. 원본 이메일 상태 업데이트
await db.update(emails)
  .set({
    status: "replied",
    repliedAt: now(),
  })
  .where(eq(emails.id, originalEmail.id))

// 4. email_replies 테이블에 메타데이터 INSERT
const emailReply = {
  id: uuid(),
  workspaceId: originalEmail.workspaceId,
  originalEmailId: originalEmail.id, // 원본 발송 이메일
  replyEmailId: replyEmail.id, // 수신한 답장 이메일

  sentiment: null, // AI 분석 예정
  intent: null, // AI 분석 예정
  aiSummary: null, // AI 분석 예정
  isRead: false, // 읽지 않음
  assignedTo: null, // 담당자 미할당

  createdAt: now(),
}

// 5. email_threads 테이블 업데이트
await db.update(emailThreads)
  .set({
    lastEmailId: replyEmail.id,
    lastActivityAt: now(),
  })
  .where(eq(emailThreads.id, originalEmail.threadId))
```

#### 2.3 AI 분석 처리 (비동기)

답장 이메일 저장 후 백그라운드 작업으로 AI 분석 수행:

```typescript
// AI 분석 결과로 email_replies 업데이트
await db.update(emailReplies)
  .set({
    sentiment: "positive", // "positive" | "neutral" | "negative" | "interested" | "not_interested"
    intent: "meeting_request", // 분류된 의도
    aiSummary: "바이어가 제품에 관심을 표명하고 다음 주 화요일 미팅을 제안함",
  })
  .where(eq(emailReplies.replyEmailId, replyEmail.id))
```

---

### 시나리오 3: 연속 답장 처리 (Re: Re: ...)

원본 이메일에 대해 여러 번 답장이 오갈 경우:

```typescript
// 이전 답장 찾기
const previousReply = await db
  .select()
  .from(emails)
  .where(and(
    eq(emails.threadId, threadId),
    eq(emails.direction, "inbound")
  ))
  .orderBy(desc(emails.createdAt))
  .limit(1)

// 새로운 답장 저장 (위 시나리오 2와 동일하게 처리)
// inReplyTo는 이전 답장의 messageId를 참조
// threadId는 동일하게 유지
```

**중요:**
- 같은 `threadId`로 모든 이메일을 그룹화
- `email_threads.lastEmailId`는 항상 최신 이메일을 가리킴
- `email_threads.lastActivityAt`는 마지막 답장 시각

---

## 이메일 상태 전이 다이어그램

### Outbound 이메일
```
draft → scheduled → queued → sent → delivered → opened → clicked
                                  ↓
                              bounced / failed / spam
```

### Inbound 이메일
```
(수신) → delivered (첫 수신 이메일)
(수신) → replied (발송한 이메일에 대한 답장)
```

---

## 데이터 조회 쿼리 예시

### 1. 특정 Lead의 전체 이메일 히스토리 조회 (시간순)

```typescript
const emailHistory = await db
  .select()
  .from(emails)
  .where(eq(emails.leadId, leadId))
  .orderBy(asc(emails.createdAt))
```

### 2. 특정 스레드의 모든 이메일 조회

```typescript
const threadEmails = await db
  .select()
  .from(emails)
  .where(eq(emails.threadId, threadId))
  .orderBy(asc(emails.createdAt))
```

### 3. 답장받은 이메일 목록 (답장 메타데이터 포함)

```typescript
const repliedEmails = await db
  .select({
    // emails 테이블 필드
    emailId: emails.id,
    subject: emails.subject,
    fromEmail: emails.fromEmail,
    repliedAt: emails.repliedAt,
    // email_replies 테이블 필드
    sentiment: emailReplies.sentiment,
    intent: emailReplies.intent,
    aiSummary: emailReplies.aiSummary,
    isRead: emailReplies.isRead,
    // leads 테이블 필드
    leadName: leads.name,
  })
  .from(emails)
  .innerJoin(emailReplies, eq(emailReplies.replyEmailId, emails.id))
  .leftJoin(leads, eq(emails.leadId, leads.id))
  .where(and(
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "inbound"),
    eq(emails.status, "replied"),
  ))
  .orderBy(desc(emails.repliedAt))
```

### 4. 응답률 계산

```typescript
// 발송한 이메일 수
const sentCount = await db
  .select({ count: count() })
  .from(emails)
  .where(and(
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "outbound"),
    inArray(emails.status, ["sent", "delivered", "opened", "clicked", "replied"]),
  ))

// 답장받은 이메일 수
const repliedCount = await db
  .select({ count: count() })
  .from(emails)
  .where(and(
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "outbound"),
    eq(emails.status, "replied"),
  ))

const responseRate = (repliedCount / sentCount) * 100
```

---

## Inbound Parse 웹훅 엔드포인트 구현 예시

```typescript
app.post("/webhooks/inbound-parse", async ({ body, set }) => {
  try {
    // 1. SendGrid Inbound Parse 데이터 파싱
    const parsedEmail = parseInboundEmail(body)

    // 2. In-Reply-To 헤더로 원본 이메일 찾기
    const inReplyTo = parsedEmail.headers['In-Reply-To']
    if (!inReplyTo) {
      // 답장이 아닌 새로운 수신 이메일
      await saveNewInboundEmail(parsedEmail)
      return { success: true, type: "new_email" }
    }

    // 3. 원본 이메일 조회
    const [originalEmail] = await db
      .select()
      .from(emails)
      .where(eq(emails.messageId, inReplyTo))
      .limit(1)

    if (!originalEmail) {
      // 원본을 찾을 수 없는 경우 (외부에서 온 이메일)
      await saveNewInboundEmail(parsedEmail)
      return { success: true, type: "external_email" }
    }

    // 4. 답장 이메일 저장 (시나리오 2 로직)
    const replyEmailId = await saveReplyEmail(parsedEmail, originalEmail)

    // 5. 백그라운드 AI 분석 작업 큐에 추가
    await queueAIAnalysis(replyEmailId)

    return { success: true, type: "reply", replyEmailId }

  } catch (error) {
    console.error("Inbound Parse Error:", error)
    set.status = 500
    return { success: false, error: error.message }
  }
})
```

---

## 주의사항 및 권장사항

### 1. Message-ID 관리
- 모든 발송 이메일에 고유한 `Message-ID` 생성 (예: `<uuid@yourdomain.com>`)
- SendGrid가 자동 생성하는 경우 웹훅에서 받아서 저장
- `Message-ID`는 답장 추적의 핵심이므로 반드시 저장

### 2. Thread 관리
- 첫 이메일 발송 시 `email_threads` 생성
- 모든 관련 이메일은 같은 `threadId` 사용
- `lastEmailId`와 `lastActivityAt`는 실시간 업데이트

### 3. Inbound Parse 설정
- SendGrid에서 Inbound Parse 도메인 설정 (예: `inbound.yourdomain.com`)
- MX 레코드 설정으로 이메일 수신
- 웹훅 URL 설정: `https://your-api.com/webhooks/inbound-parse`

### 4. 중복 방지
- `messageId`를 unique 제약조건으로 설정하거나
- 저장 전 중복 체크 수행
- 같은 웹훅 이벤트가 여러 번 올 수 있으므로 idempotency 보장

### 5. AI 분석 처리
- 답장 저장은 즉시 처리 (동기)
- AI 분석은 백그라운드 작업으로 분리 (비동기)
- 작업 큐 사용 권장 (예: BullMQ, Redis Queue)

### 6. 에러 처리
- Inbound Parse 실패 시 원본 이메일 백업
- 재처리 로직 구현 (retry mechanism)
- 실패한 이메일은 별도 테이블 또는 로그에 저장

---

## 구현 체크리스트

### Backend
- [ ] Inbound Parse 웹훅 엔드포인트 구현
- [ ] 이메일 파싱 로직 구현
- [ ] 원본 이메일 찾기 로직 구현
- [ ] 답장 이메일 저장 로직 구현
- [ ] email_replies 테이블 연동
- [ ] email_threads 업데이트 로직
- [ ] AI 분석 백그라운드 작업 구현
- [ ] 중복 방지 로직 구현

### SendGrid 설정
- [ ] Inbound Parse 도메인 설정
- [ ] MX 레코드 DNS 설정
- [ ] 웹훅 URL 등록
- [ ] 웹훅 서명 검증 (선택)

### Frontend
- [ ] 답장 이메일 목록 UI (이미 구현됨)
- [ ] 스레드 뷰 UI
- [ ] 답장 상세 보기 UI
- [ ] AI 분석 결과 표시 UI
- [ ] 담당자 할당 기능

### 모니터링
- [ ] 웹훅 수신 로깅
- [ ] 이메일 처리 성공/실패 메트릭
- [ ] AI 분석 성공률 모니터링
- [ ] 응답률 대시보드

---

## 참고 자료

- [SendGrid Inbound Parse Documentation](https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322)
- [Email Threading Best Practices](https://www.jwz.org/doc/threading.html)
