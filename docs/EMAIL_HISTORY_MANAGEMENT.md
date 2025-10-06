# 이메일 히스토리 관리 가이드

## 개요

이 문서는 SendGrid Inbound Parse 웹훅을 통해 수신한 이메일의 히스토리를 관리하는 방법을 설명합니다. 현재 데이터베이스 구조를 활용하여 이메일 스레드를 추적하고, 대화 흐름을 유지하는 방법을 제시합니다.

**작성일:** 2025년 10월 6일
**기반 스키마:** `elysia-server/src/db/schema/emails.ts`
**참고 문서:** `docs/WEBHOOK_DATA_ANALYSIS.md`

---

## 현재 데이터베이스 구조

### 1. 핵심 테이블

#### `emails` 테이블
모든 이메일(inbound/outbound)을 저장하는 메인 테이블입니다.

**히스토리 관련 주요 필드:**
```typescript
{
  id: uuid,                      // 이메일 고유 ID
  threadId: uuid,                // 스레드 그룹 ID
  messageId: varchar(500),       // RFC 822 Message-ID 헤더
  inReplyTo: varchar(500),       // 답장 대상 Message-ID
  direction: "inbound" | "outbound",
  fromEmail: varchar(255),
  toEmail: varchar(255),
  subject: varchar(500),
  rawEmail: text,                // RFC 822 원본 이메일
  sentAt: timestamp,
  repliedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**인덱스:**
- `emails_thread_id_idx` - 스레드별 조회 최적화
- `emails_message_id_idx` - Message-ID 빠른 검색
- `emails_in_reply_to_idx` - 답장 체인 추적

#### `email_threads` 테이블
이메일 대화 스레드의 메타데이터를 관리합니다.

```typescript
{
  id: uuid,                      // 스레드 고유 ID
  workspaceId: uuid,
  leadId: uuid,                  // 리드 연결
  subject: varchar(500),         // 스레드 제목 (첫 이메일 제목)
  firstEmailId: uuid,            // 스레드의 첫 이메일
  lastEmailId: uuid,             // 스레드의 최근 이메일
  lastActivityAt: timestamp,     // 마지막 활동 시간
  status: "active" | "archived" | "snoozed",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `email_replies` 테이블
이메일 간의 답장 관계를 명시적으로 추적합니다.

```typescript
{
  id: uuid,
  workspaceId: uuid,
  originalEmailId: uuid,         // 원본 이메일
  replyEmailId: uuid,            // 답장 이메일
  sentiment: "positive" | "neutral" | "negative" | "interested" | "not_interested",
  intent: varchar(255),          // 답장 의도 분류
  aiSummary: text,               // AI 요약
  isRead: boolean,
  assignedTo: uuid,              // 담당자 할당
  createdAt: timestamp
}
```

#### `email_events` 테이블
SendGrid 웹훅 이벤트를 추적합니다.

```typescript
{
  id: uuid,
  emailId: uuid,
  eventType: "processed" | "delivered" | "open" | "click" | "bounce" | ...,
  timestamp: timestamp,
  rawEventData: jsonb,           // 전체 웹훅 페이로드
  processed: boolean,
  createdAt: timestamp
}
```

---

## 이메일 히스토리 관리 메커니즘

### 1. 스레드 구분 기준

이메일 스레드를 구분하는 3가지 주요 메커니즘:

#### A. Message-ID와 In-Reply-To 헤더 (RFC 822)

**Message-ID:**
- 각 이메일의 고유 식별자
- 형식: `<unique-id@domain.com>`
- 예시: `<CAAt3oNgzVftS0vhkfJJBrfxy3Y2htqaq9CYcpxMZtC7WnUYC1A@mail.gmail.com>`

**In-Reply-To:**
- 답장하는 원본 이메일의 Message-ID
- 답장 체인 추적의 핵심

**References:**
- 전체 대화 히스토리의 Message-ID 목록
- 형식: `<msg-id-1> <msg-id-2> <msg-id-3>`
- 깊은 스레드 추적 가능

**예시 흐름:**
```
이메일 A (최초):
  Message-ID: <abc123@gmail.com>
  In-Reply-To: (없음)

이메일 B (A에 대한 답장):
  Message-ID: <def456@gmail.com>
  In-Reply-To: <abc123@gmail.com>
  References: <abc123@gmail.com>

이메일 C (B에 대한 답장):
  Message-ID: <ghi789@gmail.com>
  In-Reply-To: <def456@gmail.com>
  References: <abc123@gmail.com> <def456@gmail.com>
```

#### B. Subject 기반 매칭

Message-ID가 없거나 손상된 경우의 대체 방법:

**Subject 정규화 규칙:**
1. `Re:`, `RE:`, `Fwd:`, `FW:` 접두사 제거
2. 공백 정규화
3. 대소문자 무시

**예시:**
```
"Hello World"
"Re: Hello World"
"RE: Re: Hello World"
→ 모두 동일한 스레드로 간주
```

**한계:**
- 동일한 제목의 다른 대화 구분 불가
- Message-ID 기반 추적이 우선

#### C. Lead 기반 그룹핑

특정 리드(고객)와의 모든 이메일 대화:

```typescript
{
  leadId: uuid,              // 리드 연결
  fromEmail: "lead@example.com",
  toEmail: "rinda@send.grinda.ai"
}
```

**쿼리 예시:**
```sql
-- 특정 리드와의 모든 이메일 히스토리
SELECT * FROM emails
WHERE lead_id = '...'
ORDER BY sent_at DESC;

-- 특정 리드의 모든 스레드
SELECT * FROM email_threads
WHERE lead_id = '...'
ORDER BY last_activity_at DESC;
```

### 2. 히스토리 추적 우선순위

```
1순위: Message-ID + In-Reply-To (가장 정확)
   ↓
2순위: References 헤더 (전체 체인)
   ↓
3순위: Subject 정규화 + Lead ID
   ↓
4순위: Lead ID만 (별도 대화로 간주)
```

---

## 웹훅 수신 시 히스토리 처리 플로우

### 1. Inbound Email 처리 프로세스

```typescript
async function processInboundEmail(payload: SendGridInboundPayload) {
  // 1. 원본 이메일에서 헤더 추출
  const headers = parseRFC822Headers(payload.email)
  const messageId = headers["message-id"]
  const inReplyTo = headers["in-reply-to"]
  const references = headers["references"]

  // 2. 발신자 리드 찾기 또는 생성
  const lead = await findOrCreateLead(payload.from)

  // 3. 답장 여부 확인
  let threadId: string | null = null
  let originalEmailId: string | null = null

  if (inReplyTo) {
    // 답장인 경우: 원본 이메일 찾기
    const originalEmail = await db.query.emails.findFirst({
      where: eq(emails.messageId, inReplyTo)
    })

    if (originalEmail) {
      threadId = originalEmail.threadId
      originalEmailId = originalEmail.id
    }
  }

  // 4. 스레드 없으면 새로 생성 (최초 이메일)
  if (!threadId) {
    const thread = await db.insert(emailThreads).values({
      workspaceId: workspace.id,
      leadId: lead.id,
      subject: normalizeSubject(payload.subject),
      lastActivityAt: new Date()
    }).returning()

    threadId = thread[0].id
  }

  // 5. 이메일 저장
  const newEmail = await db.insert(emails).values({
    workspaceId: workspace.id,
    userEmailAccountId: emailAccount.id,
    leadId: lead.id,
    threadId: threadId,
    direction: "inbound",
    fromEmail: parseEmail(payload.from),
    toEmail: payload.to,
    subject: payload.subject,
    bodyText: payload.text,
    bodyHtml: payload.html,
    rawEmail: payload.email,
    messageId: messageId,
    inReplyTo: inReplyTo,
    sentAt: headers["date"] || new Date(),
    status: "delivered"
  }).returning()

  // 6. 스레드 메타데이터 업데이트
  await db.update(emailThreads)
    .set({
      lastEmailId: newEmail[0].id,
      lastActivityAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(emailThreads.id, threadId))

  // 7. 답장 관계 기록
  if (originalEmailId) {
    await db.insert(emailReplies).values({
      workspaceId: workspace.id,
      originalEmailId: originalEmailId,
      replyEmailId: newEmail[0].id,
      isRead: false
    })

    // 원본 이메일 상태 업데이트
    await db.update(emails)
      .set({
        status: "replied",
        repliedAt: new Date()
      })
      .where(eq(emails.id, originalEmailId))
  }

  return newEmail[0]
}
```

### 2. RFC 822 헤더 파싱 유틸리티

```typescript
function parseRFC822Headers(rawEmail: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const headerSection = rawEmail.split(/\r?\n\r?\n/)[0]

  // 멀티라인 헤더 처리
  const lines = headerSection.split(/\r?\n/)
  let currentHeader = ""
  let currentValue = ""

  for (const line of lines) {
    if (line.match(/^\s+/)) {
      // 이전 헤더의 연속
      currentValue += " " + line.trim()
    } else {
      // 새 헤더
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = currentValue.trim()
      }

      const match = line.match(/^([^:]+):\s*(.*)$/)
      if (match) {
        currentHeader = match[1]
        currentValue = match[2]
      }
    }
  }

  // 마지막 헤더 저장
  if (currentHeader) {
    headers[currentHeader.toLowerCase()] = currentValue.trim()
  }

  return headers
}
```

### 3. Subject 정규화 함수

```typescript
function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return ""

  return subject
    .replace(/^(re|fw|fwd):\s*/gi, "")  // 접두사 제거
    .replace(/\s+/g, " ")                // 공백 정규화
    .trim()
    .toLowerCase()
}
```

---

## 히스토리 조회 쿼리

### 1. 특정 스레드의 전체 이메일 히스토리

```typescript
// 시간순 정렬 (오래된 것 → 최신)
async function getThreadHistory(threadId: string) {
  return await db.query.emails.findMany({
    where: eq(emails.threadId, threadId),
    orderBy: [asc(emails.sentAt)],
    with: {
      lead: true,
      emailAccount: true
    }
  })
}
```

**SQL 직접 사용:**
```sql
SELECT
  e.*,
  l.email as lead_email,
  l.name as lead_name
FROM emails e
LEFT JOIN leads l ON e.lead_id = l.id
WHERE e.thread_id = '...'
ORDER BY e.sent_at ASC;
```

### 2. 특정 이메일의 답장 체인 추적

```typescript
async function getReplyChain(emailId: string) {
  // 하위 답장 가져오기
  const replies = await db.query.emailReplies.findMany({
    where: eq(emailReplies.originalEmailId, emailId),
    with: {
      replyEmail: {
        with: {
          lead: true
        }
      }
    }
  })

  // 재귀적으로 모든 답장 추적
  const chain = []
  for (const reply of replies) {
    chain.push(reply)
    const subReplies = await getReplyChain(reply.replyEmailId)
    chain.push(...subReplies)
  }

  return chain
}
```

### 3. 리드별 전체 이메일 히스토리

```typescript
async function getLeadEmailHistory(leadId: string, limit = 50) {
  return await db.query.emails.findMany({
    where: eq(emails.leadId, leadId),
    orderBy: [desc(emails.sentAt)],
    limit: limit,
    with: {
      thread: true
    }
  })
}
```

### 4. 스레드 요약 정보

```typescript
async function getThreadSummary(threadId: string) {
  const thread = await db.query.emailThreads.findFirst({
    where: eq(emailThreads.id, threadId),
    with: {
      firstEmail: true,
      lastEmail: true,
      lead: true,
      emails: {
        orderBy: [asc(emails.sentAt)]
      }
    }
  })

  if (!thread) return null

  const emailCount = thread.emails.length
  const inboundCount = thread.emails.filter(e => e.direction === "inbound").length
  const outboundCount = thread.emails.filter(e => e.direction === "outbound").length

  return {
    ...thread,
    stats: {
      totalEmails: emailCount,
      inbound: inboundCount,
      outbound: outboundCount,
      lastActivity: thread.lastActivityAt
    }
  }
}
```

### 5. 활성 스레드 목록 (대시보드용)

```typescript
async function getActiveThreads(workspaceId: string, limit = 20) {
  return await db.query.emailThreads.findMany({
    where: and(
      eq(emailThreads.workspaceId, workspaceId),
      eq(emailThreads.status, "active")
    ),
    orderBy: [desc(emailThreads.lastActivityAt)],
    limit: limit,
    with: {
      lead: true,
      lastEmail: true
    }
  })
}
```

---

## 고급 기능

### 1. 답장 감지 및 자동 분류

```typescript
async function analyzeReply(replyEmail: Email, originalEmail: Email) {
  // AI를 통한 sentiment 분석
  const sentiment = await analyzeSentiment(replyEmail.bodyText || replyEmail.bodyHtml)

  // Intent 추출
  const intent = await extractIntent(replyEmail.bodyText || replyEmail.bodyHtml)

  // AI 요약
  const aiSummary = await summarizeEmail(replyEmail.bodyText || replyEmail.bodyHtml)

  // email_replies 업데이트
  await db.update(emailReplies)
    .set({
      sentiment: sentiment,
      intent: intent,
      aiSummary: aiSummary
    })
    .where(and(
      eq(emailReplies.replyEmailId, replyEmail.id),
      eq(emailReplies.originalEmailId, originalEmail.id)
    ))
}
```

### 2. 스레드 병합 (중복 제거)

```typescript
async function mergeThreads(primaryThreadId: string, secondaryThreadId: string) {
  // 1. 모든 이메일을 primary 스레드로 이동
  await db.update(emails)
    .set({ threadId: primaryThreadId })
    .where(eq(emails.threadId, secondaryThreadId))

  // 2. primary 스레드 메타데이터 업데이트
  const allEmails = await db.query.emails.findMany({
    where: eq(emails.threadId, primaryThreadId),
    orderBy: [asc(emails.sentAt)]
  })

  await db.update(emailThreads)
    .set({
      firstEmailId: allEmails[0].id,
      lastEmailId: allEmails[allEmails.length - 1].id,
      lastActivityAt: allEmails[allEmails.length - 1].sentAt
    })
    .where(eq(emailThreads.id, primaryThreadId))

  // 3. secondary 스레드 삭제
  await db.delete(emailThreads)
    .where(eq(emailThreads.id, secondaryThreadId))
}
```

### 3. 스레드 분리

```typescript
async function splitThread(emailId: string) {
  const email = await db.query.emails.findFirst({
    where: eq(emails.id, emailId)
  })

  if (!email) throw new Error("Email not found")

  // 1. 새 스레드 생성
  const newThread = await db.insert(emailThreads).values({
    workspaceId: email.workspaceId,
    leadId: email.leadId,
    subject: email.subject,
    firstEmailId: emailId,
    lastEmailId: emailId,
    lastActivityAt: email.sentAt
  }).returning()

  // 2. 해당 이메일 및 이후 답장들을 새 스레드로 이동
  const replyChain = await getReplyChain(emailId)
  const emailIds = [emailId, ...replyChain.map(r => r.replyEmailId)]

  await db.update(emails)
    .set({ threadId: newThread[0].id })
    .where(inArray(emails.id, emailIds))

  return newThread[0]
}
```

### 4. 읽지 않은 답장 알림

```typescript
async function getUnreadReplies(workspaceId: string, assignedTo?: string) {
  const query = and(
    eq(emailReplies.workspaceId, workspaceId),
    eq(emailReplies.isRead, false),
    assignedTo ? eq(emailReplies.assignedTo, assignedTo) : undefined
  )

  return await db.query.emailReplies.findMany({
    where: query,
    orderBy: [desc(emailReplies.createdAt)],
    with: {
      originalEmail: {
        with: {
          lead: true
        }
      },
      replyEmail: true
    }
  })
}

// 답장 읽음 처리
async function markReplyAsRead(replyId: string) {
  await db.update(emailReplies)
    .set({ isRead: true })
    .where(eq(emailReplies.id, replyId))
}
```

---

## 웹훅 데이터와 히스토리 연결

### SendGrid Inbound Parse → 히스토리 매핑

| SendGrid 필드 | 히스토리 용도 |
|---------------|--------------|
| `email` (raw) | RFC 822 파싱 → Message-ID, In-Reply-To 추출 |
| `envelope.from` | Lead 매칭, 발신자 식별 |
| `envelope.to` | Email Account 매칭 |
| `subject` | 스레드 정규화 매칭 |
| `text`, `html` | 답장 감정 분석, AI 요약 |
| `dkim`, `SPF` | 신뢰도 평가 |

### 웹훅 처리 서비스 예시

```typescript
// elysia-server/src/services/webhook.service.ts

export class WebhookService {
  async processInboundEmail(
    body: SendGridInboundPayload,
    files: FileData[]
  ) {
    // 1. 헤더 추출
    const headers = this.parseHeaders(body.email)

    // 2. Lead 찾기/생성
    const lead = await this.findOrCreateLead(body.from)

    // 3. 스레드 확인 및 생성
    const threadId = await this.resolveThread({
      messageId: headers["message-id"],
      inReplyTo: headers["in-reply-to"],
      references: headers["references"],
      subject: body.subject,
      leadId: lead.id
    })

    // 4. 이메일 저장
    const email = await this.saveEmail({
      ...body,
      threadId,
      leadId: lead.id,
      messageId: headers["message-id"],
      inReplyTo: headers["in-reply-to"]
    })

    // 5. 답장 관계 기록
    if (headers["in-reply-to"]) {
      await this.recordReply(email.id, headers["in-reply-to"])
    }

    // 6. 스레드 메타데이터 업데이트
    await this.updateThreadMetadata(threadId, email.id)

    return email
  }

  private async resolveThread(params: {
    messageId?: string
    inReplyTo?: string
    references?: string
    subject: string
    leadId: string
  }): Promise<string> {
    // In-Reply-To로 원본 이메일 찾기
    if (params.inReplyTo) {
      const originalEmail = await db.query.emails.findFirst({
        where: eq(emails.messageId, params.inReplyTo)
      })

      if (originalEmail?.threadId) {
        return originalEmail.threadId
      }
    }

    // References로 스레드 찾기
    if (params.references) {
      const messageIds = params.references.split(/\s+/)
      for (const msgId of messageIds.reverse()) {
        const email = await db.query.emails.findFirst({
          where: eq(emails.messageId, msgId)
        })

        if (email?.threadId) {
          return email.threadId
        }
      }
    }

    // Subject + Lead로 스레드 찾기
    const normalizedSubject = normalizeSubject(params.subject)
    const existingThread = await db.query.emailThreads.findFirst({
      where: and(
        eq(emailThreads.leadId, params.leadId),
        eq(emailThreads.subject, normalizedSubject)
      )
    })

    if (existingThread) {
      return existingThread.id
    }

    // 새 스레드 생성
    const newThread = await db.insert(emailThreads).values({
      workspaceId: "...",  // workspace 조회 필요
      leadId: params.leadId,
      subject: normalizedSubject,
      lastActivityAt: new Date()
    }).returning()

    return newThread[0].id
  }
}
```

---

## 성능 최적화

### 1. 인덱스 활용

현재 스키마에 정의된 인덱스:
- `emails_thread_id_idx` - 스레드별 조회
- `emails_message_id_idx` - Message-ID 검색
- `emails_in_reply_to_idx` - 답장 추적
- `email_threads_last_activity_idx` - 최근 활동 정렬

### 2. 쿼리 최적화 팁

```typescript
// ❌ N+1 쿼리 문제
for (const thread of threads) {
  const emails = await db.query.emails.findMany({
    where: eq(emails.threadId, thread.id)
  })
}

// ✅ JOIN으로 한번에 조회
const threadsWithEmails = await db.query.emailThreads.findMany({
  with: {
    emails: {
      orderBy: [asc(emails.sentAt)]
    }
  }
})
```

### 3. 캐싱 전략

```typescript
// Redis 캐싱 예시
async function getCachedThread(threadId: string) {
  const cacheKey = `thread:${threadId}`

  // 캐시 확인
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // DB 조회
  const thread = await getThreadSummary(threadId)

  // 캐시 저장 (5분)
  await redis.set(cacheKey, JSON.stringify(thread), "EX", 300)

  return thread
}
```

---

## 구현 체크리스트

### Phase 1: 기본 히스토리 추적
- [x] emails 테이블에 threadId, messageId, inReplyTo 필드 존재
- [x] email_threads 테이블 정의
- [x] email_replies 테이블 정의
- [ ] RFC 822 헤더 파싱 유틸리티 구현
- [ ] 스레드 해결 로직 구현 (resolveThread)
- [ ] 웹훅 처리 시 스레드 자동 연결

### Phase 2: 고급 기능
- [ ] Subject 정규화 매칭
- [ ] References 헤더 파싱 및 추적
- [ ] 답장 체인 재귀 조회 API
- [ ] 스레드 병합/분리 기능
- [ ] 읽지 않은 답장 알림

### Phase 3: AI 기능
- [ ] 답장 sentiment 분석
- [ ] Intent 자동 분류
- [ ] AI 이메일 요약
- [ ] 자동 답장 제안

### Phase 4: UI/UX
- [ ] 스레드 뷰 (Gmail 스타일)
- [ ] 답장 인디케이터
- [ ] 스레드 검색 및 필터링
- [ ] 리드별 히스토리 타임라인

---

## 예상 시나리오

### 시나리오 1: 새 이메일 수신 (스레드 시작)

```
1. Gmail → SendGrid → 웹훅
2. Message-ID: <abc123@gmail.com>
3. In-Reply-To: (없음)
4. 시스템 처리:
   - Lead 생성/찾기
   - 새 thread 생성
   - email 저장 (threadId 연결)
   - thread의 firstEmailId 설정
```

### 시나리오 2: 답장 수신 (스레드 연결)

```
1. Gmail → SendGrid → 웹훅
2. Message-ID: <def456@gmail.com>
3. In-Reply-To: <abc123@gmail.com>
4. 시스템 처리:
   - In-Reply-To로 원본 이메일 검색
   - 기존 thread 연결
   - email 저장
   - email_replies 레코드 생성
   - 원본 이메일 status → "replied"
   - thread의 lastEmailId 업데이트
```

### 시나리오 3: 깊은 답장 체인

```
A (최초) → B (답장) → C (답장) → D (답장)

각 이메일:
- 동일한 threadId
- In-Reply-To가 이전 Message-ID
- References에 전체 체인 포함

조회 시:
- thread.emails → [A, B, C, D] (시간순)
- getReplyChain(A) → [B, C, D]
```

---

## 참고 자료

- [RFC 822 - 이메일 메시지 형식](https://www.ietf.org/rfc/rfc822.txt)
- [RFC 2822 - Internet Message Format](https://www.ietf.org/rfc/rfc2822.txt)
- [Gmail 스레드 알고리즘](https://support.google.com/mail/answer/5900?hl=en)
- SendGrid Inbound Parse: `docs/WEBHOOK_DATA_ANALYSIS.md`
- 데이터베이스 스키마: `elysia-server/src/db/schema/emails.ts`

---

## 요약

✅ **현재 테이블 구조로 완전한 이메일 히스토리 관리 가능**

**핵심 메커니즘:**
1. **Message-ID + In-Reply-To** - RFC 822 표준 추적 (가장 정확)
2. **threadId** - 스레드 그룹핑
3. **email_threads** - 스레드 메타데이터
4. **email_replies** - 명시적 답장 관계

**구현 우선순위:**
1. RFC 822 헤더 파싱 (Message-ID, In-Reply-To 추출)
2. 스레드 해결 로직 (resolveThread)
3. 웹훅 처리 시 자동 연결
4. 스레드 조회 API

**다음 단계:**
- `elysia-server/src/utils/email-parser.util.ts` - 헤더 파싱 유틸리티
- `elysia-server/src/services/email-thread.service.ts` - 스레드 관리 서비스
- 웹훅 서비스에 히스토리 로직 통합
