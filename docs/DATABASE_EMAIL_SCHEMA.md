# 데이터베이스 이메일 스키마 및 연동 관계

## 개요

이 문서는 이메일 시스템과 워크스페이스, 리드 관리 시스템 간의 데이터베이스 연동 관계를 설명합니다.

---

## 핵심 질문: 이메일 주소는 워크스페이스와 연동되어 있는가?

**답변: 예, 완전히 연동되어 있습니다.**

이메일 시스템은 다음과 같은 계층 구조로 워크스페이스와 연결되어 있습니다:

```
Workspace
    ├── User Email Accounts (워크스페이스별 이메일 계정)
    │   └── Emails (발송/수신 이메일)
    │       ├── Email Events (이메일 이벤트)
    │       └── Email Replies (답장)
    └── Leads (리드)
        └── Lead Contacts (연락처 정보, 이메일 포함)
```

---

## 데이터베이스 스키마 구조

### 1. Workspaces (워크스페이스)

**테이블:** `workspaces`

워크스페이스는 모든 리소스의 최상위 컨테이너입니다.

```typescript
{
  id: UUID (PK)
  name: string
  description: string
  ownerId: UUID (FK -> users.id)
  createdAt: timestamp
  updatedAt: timestamp
  isActive: boolean
}
```

**관계:**
- 한 워크스페이스는 여러 이메일 계정을 가질 수 있음 (1:N)
- 한 워크스페이스는 여러 이메일을 가질 수 있음 (1:N)
- 한 워크스페이스는 여러 리드를 가질 수 있음 (1:N)

---

### 2. User Email Accounts (사용자 이메일 계정)

**테이블:** `user_email_accounts`

워크스페이스에 속한 SendGrid 이메일 계정입니다. **웹훅에서 수신한 이메일의 `to` 주소와 매칭**됩니다.

```typescript
{
  id: UUID (PK)
  userId: UUID (FK -> users.id) [NOT NULL]
  workspaceId: UUID (FK -> workspaces.id) [NOT NULL, CASCADE]

  // SendGrid 설정
  emailAddress: string [NOT NULL] // 예: "rinda@send.grinda.ai"
  displayName: string
  apiKey: string [NOT NULL]
  sendgridVerifiedSenderId: string

  // 상태 및 검증
  isVerified: boolean [default: false]
  isDefault: boolean [default: false]
  status: enum ['active', 'inactive', 'error', 'rate_limited', 'suspended']

  // 전송 제한
  dailyLimit: integer
  monthlyLimit: integer
  dailySentCount: integer [default: 0]
  monthlySentCount: integer [default: 0]
  lastResetDaily: date
  lastResetMonthly: date

  lastError: text
  lastSyncAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

**인덱스:**
- `emailAddress` - 웹훅 수신 시 빠른 조회를 위함
- `workspaceId` - 워크스페이스별 이메일 계정 조회
- `userId` - 사용자별 이메일 계정 조회
- `status` - 활성 계정 필터링
- `isDefault` - 기본 계정 조회

**관계:**
- **Workspace**: N:1 (여러 이메일 계정이 하나의 워크스페이스에 속함)
- **User**: N:1 (여러 이메일 계정이 하나의 사용자에 속함)
- **Emails**: 1:N (하나의 이메일 계정이 여러 이메일을 발송/수신)

**웹훅 처리 시 사용:**
```typescript
// webhook.service.ts의 storeInboundEmailInDB 메서드
const emailAccount = await db
  .select({ id: userEmailAccounts.id, workspaceId: userEmailAccounts.workspaceId })
  .from(userEmailAccounts)
  .where(eq(userEmailAccounts.emailAddress, toEmail)) // 웹훅의 'to' 필드와 매칭
  .limit(1)
```

---

### 3. Emails (이메일)

**테이블:** `emails`

발송 및 수신된 모든 이메일을 저장합니다. **워크스페이스와 직접 연결**되어 있습니다.

```typescript
{
  id: UUID (PK)
  workspaceId: UUID (FK -> workspaces.id) [NOT NULL, CASCADE]
  userEmailAccountId: UUID (FK -> user_email_accounts.id) [NOT NULL, RESTRICT]
  leadId: UUID (FK -> leads.id) [NULL, SET NULL]
  sequenceId: UUID (FK -> sequences.id) [NULL, SET NULL]
  stepId: UUID (FK -> sequence_steps.id) [NULL, SET NULL]

  // 방향 및 기본 정보
  direction: enum ['outbound', 'inbound'] [NOT NULL]
  fromEmail: string [NOT NULL]
  toEmail: string [NOT NULL]
  ccEmails: string[]
  bccEmails: string[]

  // 내용
  subject: string
  bodyText: text
  bodyHtml: text

  // 상태
  status: enum [
    'draft', 'scheduled', 'queued', 'sent', 'delivered',
    'opened', 'clicked', 'replied', 'bounced', 'failed',
    'spam', 'unsubscribed'
  ] [default: 'draft']

  // 타이밍
  scheduledAt: timestamp
  sentAt: timestamp
  deliveredAt: timestamp
  openedAt: timestamp
  clickedAt: timestamp
  repliedAt: timestamp

  // 반송 정보
  bounceType: enum ['soft', 'hard', 'block']
  bounceReason: text
  errorMessage: text

  // Provider IDs
  sendgridMessageId: string
  messageId: string // RFC 822 Message-ID 헤더
  inReplyTo: string // 스레딩용

  // 스레드
  threadId: UUID

  // 참여 메트릭
  openCount: integer [default: 0]
  clickCount: integer [default: 0]

  // 구독 취소/스팸
  unsubscribedAt: timestamp
  spamReportedAt: timestamp

  // 재시도 로직
  retryCount: integer [default: 0]
  lastRetryAt: timestamp

  createdAt: timestamp
  updatedAt: timestamp
}
```

**인덱스:**
- `workspaceId` - **워크스페이스별 이메일 조회 (핵심)**
- `userEmailAccountId` - 이메일 계정별 조회
- `leadId` - 리드별 이메일 이력 조회
- `messageId` - 웹훅 답장 처리 시 원본 이메일 찾기
- `inReplyTo` - 스레드 추적
- `threadId` - 스레드별 이메일 조회
- `status` - 상태별 필터링
- `scheduledAt` - 예약 이메일 조회

**관계:**
- **Workspace**: N:1 (모든 이메일은 하나의 워크스페이스에 속함)
- **Email Account**: N:1 (모든 이메일은 하나의 이메일 계정을 통해 발송/수신)
- **Lead**: N:1 (선택사항, 이메일이 특정 리드와 연결될 수 있음)
- **Sequence**: N:1 (선택사항, 시퀀스 이메일인 경우)
- **Thread**: N:1 (이메일 스레드)
- **Events**: 1:N (하나의 이메일은 여러 이벤트를 가질 수 있음)

**웹훅 처리 시 저장:**
```typescript
// webhook.service.ts의 storeInboundEmailInDB 메서드
await db.insert(emailsTable).values({
  workspaceId: account.workspaceId, // 이메일 계정에서 가져온 워크스페이스 ID
  userEmailAccountId: account.id,
  leadId, // lead_contacts에서 fromEmail로 검색하여 찾은 리드 ID
  direction: "inbound",
  fromEmail,
  toEmail,
  subject: body.subject || "",
  bodyText: body.text,
  bodyHtml: body.html,
  sentAt: new Date(),
  messageId: headers.messageId,
  inReplyTo: headers.inReplyTo,
})
```

---

### 4. Leads (리드)

**테이블:** `leads`

잠재 고객 정보를 저장합니다. **워크스페이스에 속함**.

```typescript
{
  id: UUID (PK)
  workspaceId: UUID (FK -> workspaces.id) [NOT NULL, CASCADE]

  // 회사 정보
  companyName: string
  foundCompanyName: string
  websiteUrl: string
  businessType: string
  description: text

  // 위치
  address: text
  country: string
  city: string
  state: string

  // 리드 관리
  leadSource: string
  leadStatus: enum ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost', 'unsubscribed']
  leadScore: integer
  notes: text

  createdBy: UUID (FK -> users.id)
  createdAt: timestamp
  updatedAt: timestamp
  lastContactedAt: timestamp
}
```

**관계:**
- **Workspace**: N:1 (모든 리드는 하나의 워크스페이스에 속함)
- **Contacts**: 1:N (하나의 리드는 여러 연락처를 가질 수 있음)
- **Emails**: 1:N (하나의 리드는 여러 이메일을 주고받을 수 있음)

---

### 5. Lead Contacts (리드 연락처)

**테이블:** `lead_contacts`

리드의 이메일, 전화번호 등의 연락처 정보를 저장합니다.

```typescript
{
  id: UUID (PK)
  leadId: UUID (FK -> leads.id) [NOT NULL, CASCADE]
  contactType: enum ['phone', 'email', 'fax', 'other'] [NOT NULL]
  contactValue: string [NOT NULL] // 실제 연락처 (이메일 주소, 전화번호 등)
  label: string // 예: 'main', 'support', 'sales'
  isPrimary: boolean [default: false]
  isVerified: boolean [default: false]
  createdAt: timestamp
  updatedAt: timestamp
}
```

**인덱스:**
- `leadId` - 리드별 연락처 조회
- `contactType` - 연락처 유형별 필터링
- `isPrimary` - 기본 연락처 조회

**웹훅 처리 시 사용:**
```typescript
// webhook.service.ts의 storeInboundEmailInDB 메서드
const leadContactResults = await db
  .select({ leadId: leadContacts.leadId })
  .from(leadContacts)
  .where(
    and(
      eq(leadContacts.contactType, "email"),
      eq(leadContacts.contactValue, fromEmail) // 웹훅의 'from' 필드와 매칭
    )
  )
  .limit(1)

const leadId = leadContactResults.length > 0 ? leadContactResults[0]?.leadId : null
```

---

### 6. Email Replies (이메일 답장)

**테이블:** `email_replies`

원본 이메일과 답장 이메일 간의 관계를 추적합니다.

```typescript
{
  id: UUID (PK)
  workspaceId: UUID (FK -> workspaces.id) [NOT NULL, CASCADE]
  originalEmailId: UUID (FK -> emails.id) [NOT NULL, CASCADE]
  replyEmailId: UUID (FK -> emails.id) [NOT NULL, CASCADE]

  // AI 분석
  sentiment: enum ['positive', 'neutral', 'negative', 'interested', 'not_interested']
  intent: string
  aiSummary: text

  // 관리
  isRead: boolean [default: false]
  assignedTo: UUID (FK -> users.id)

  createdAt: timestamp
}
```

**인덱스:**
- `workspaceId` - 워크스페이스별 답장 조회
- `originalEmailId` - 원본 이메일의 답장 찾기
- `replyEmailId` - 답장 이메일 정보 조회
- `sentiment` - 감정 분석 기반 필터링
- `isRead` - 읽지 않은 답장 조회

**웹훅 처리 시 저장:**
```typescript
// 답장인 경우 (In-Reply-To 헤더가 있는 경우)
if (headers.inReplyTo) {
  const originalEmail = await db
    .select({ id: emailsTable.id, workspaceId: emailsTable.workspaceId })
    .from(emailsTable)
    .where(
      and(
        eq(emailsTable.messageId, headers.inReplyTo),
        eq(emailsTable.direction, "outbound")
      )
    )
    .limit(1)

  if (originalEmail) {
    await db.insert(emailReplies).values({
      workspaceId: originalEmail.workspaceId,
      originalEmailId: originalEmail.id,
      replyEmailId: inboundEmail.id,
      isRead: false,
    })
  }
}
```

---

### 7. Email Events (이메일 이벤트)

**테이블:** `email_events`

SendGrid 웹훅에서 받은 이메일 이벤트를 저장합니다.

```typescript
{
  id: UUID (PK)
  emailId: UUID (FK -> emails.id) [NOT NULL, CASCADE]
  eventType: enum [
    'processed', 'delivered', 'open', 'click',
    'bounce', 'dropped', 'deferred', 'spam_report', 'unsubscribe'
  ] [NOT NULL]
  timestamp: timestamp [NOT NULL]

  // 이벤트 세부사항
  sendgridEventId: string
  userAgent: text
  ipAddress: string
  url: text // 클릭 이벤트용
  bounceType: string
  bounceReason: text
  smtpResponse: text

  rawEventData: jsonb // 전체 웹훅 페이로드
  processed: boolean [default: false]
  createdAt: timestamp
}
```

**인덱스:**
- `emailId` - 이메일별 이벤트 조회
- `eventType` - 이벤트 유형별 필터링
- `timestamp` - 시간순 정렬
- `processed` - 처리되지 않은 이벤트 조회

---

### 8. Email Threads (이메일 스레드)

**테이블:** `email_threads`

이메일 대화 스레드를 그룹화합니다.

```typescript
{
  id: UUID (PK)
  workspaceId: UUID (FK -> workspaces.id) [NOT NULL, CASCADE]
  leadId: UUID (FK -> leads.id) [NULL, SET NULL]
  subject: string
  firstEmailId: UUID
  lastEmailId: UUID
  lastActivityAt: timestamp
  status: enum ['active', 'archived', 'snoozed'] [default: 'active']
  createdAt: timestamp
  updatedAt: timestamp
}
```

**관계:**
- **Workspace**: N:1 (모든 스레드는 하나의 워크스페이스에 속함)
- **Lead**: N:1 (선택사항)
- **Emails**: 1:N (하나의 스레드는 여러 이메일을 포함)

---

## 워크스페이스 연동 흐름도

### 웹훅 수신 시 데이터 흐름

```
1. SendGrid Inbound Parse Webhook
   ↓
2. POST /api/webhook/inbound
   - body.to: "rinda@send.grinda.ai"
   - body.from: "sender@example.com"
   - body.subject: "..."
   ↓
3. user_email_accounts 테이블에서 이메일 계정 조회
   WHERE emailAddress = body.to
   ↓
4. 이메일 계정에서 workspaceId 추출
   ↓
5. lead_contacts 테이블에서 리드 조회 (선택사항)
   WHERE contactType = 'email' AND contactValue = body.from
   ↓
6. emails 테이블에 저장
   - workspaceId: 이메일 계정의 워크스페이스 ID
   - userEmailAccountId: 이메일 계정 ID
   - leadId: 찾은 리드 ID (없으면 NULL)
   - direction: "inbound"
   - fromEmail, toEmail, subject, bodyText, bodyHtml
   - messageId, inReplyTo (스레딩용)
   ↓
7. 답장 감지 (inReplyTo 헤더가 있는 경우)
   - 원본 이메일 조회 (messageId로)
   - email_replies 테이블에 관계 저장
   - 원본 이메일의 repliedAt 업데이트
```

---

## 주요 연동 관계 요약

### ✅ 이메일 주소 → 워크스페이스 연동

1. **User Email Accounts (`user_email_accounts`)**
   - `workspaceId` 필드로 워크스페이스와 직접 연결
   - `emailAddress` 필드로 수신 이메일 주소 저장
   - 웹훅의 `to` 필드와 매칭하여 워크스페이스 식별

2. **Emails (`emails`)**
   - `workspaceId` 필드로 워크스페이스와 직접 연결
   - `userEmailAccountId` 필드로 이메일 계정과 연결
   - 모든 이메일은 워크스페이스에 속함

3. **Lead Contacts (`lead_contacts`)**
   - `leadId`를 통해 리드와 연결
   - 리드는 `workspaceId`를 통해 워크스페이스와 연결
   - 웹훅의 `from` 필드와 매칭하여 발신자 리드 식별

### 계층 구조

```
Workspace (워크스페이스)
├─ User Email Accounts (이메일 계정)
│  └─ emailAddress: "rinda@send.grinda.ai"
│
├─ Emails (이메일)
│  ├─ userEmailAccountId
│  ├─ leadId (선택)
│  └─ 모든 이메일 데이터
│
└─ Leads (리드)
   └─ Lead Contacts (연락처)
      └─ contactValue: "sender@example.com"
```

---

## 데이터 격리 및 보안

### 워크스페이스별 데이터 격리

모든 핵심 테이블은 `workspaceId`를 가지고 있어 **완벽한 데이터 격리**를 제공합니다:

- `user_email_accounts.workspaceId`
- `emails.workspaceId`
- `email_replies.workspaceId`
- `email_threads.workspaceId`
- `leads.workspaceId`

### CASCADE 동작

워크스페이스가 삭제되면:
- ✅ 모든 이메일 계정 삭제 (`ON DELETE CASCADE`)
- ✅ 모든 이메일 삭제 (`ON DELETE CASCADE`)
- ✅ 모든 이메일 답장 삭제 (`ON DELETE CASCADE`)
- ✅ 모든 리드 삭제 (`ON DELETE CASCADE`)
- ✅ 모든 리드 연락처 삭제 (`ON DELETE CASCADE`)

---

## 쿼리 예시

### 1. 특정 워크스페이스의 모든 이메일 계정 조회

```typescript
const emailAccounts = await db
  .select()
  .from(userEmailAccounts)
  .where(eq(userEmailAccounts.workspaceId, workspaceId))
```

### 2. 특정 워크스페이스의 모든 인바운드 이메일 조회

```typescript
const inboundEmails = await db
  .select()
  .from(emails)
  .where(
    and(
      eq(emails.workspaceId, workspaceId),
      eq(emails.direction, "inbound")
    )
  )
  .orderBy(desc(emails.createdAt))
```

### 3. 특정 리드의 모든 이메일 조회

```typescript
const leadEmails = await db
  .select()
  .from(emails)
  .where(
    and(
      eq(emails.workspaceId, workspaceId),
      eq(emails.leadId, leadId)
    )
  )
  .orderBy(asc(emails.sentAt))
```

### 4. 특정 이메일 계정으로 수신한 이메일 조회

```typescript
const receivedEmails = await db
  .select()
  .from(emails)
  .where(
    and(
      eq(emails.userEmailAccountId, emailAccountId),
      eq(emails.direction, "inbound")
    )
  )
```

### 5. 답장이 온 이메일 조회

```typescript
const repliedEmails = await db
  .select({
    email: emails,
    reply: emailReplies
  })
  .from(emails)
  .innerJoin(emailReplies, eq(emailReplies.originalEmailId, emails.id))
  .where(eq(emails.workspaceId, workspaceId))
```

---

## 웹훅 처리 구현

### 현재 구현 (webhook.service.ts)

```typescript
private async storeInboundEmailInDB(
  body: SendGridInboundPayload,
  headers: { messageId: string | undefined; inReplyTo: string | undefined; references: string[] },
  _attachments: unknown[],
) {
  // 1. 수신 이메일 주소로 이메일 계정 찾기
  const emailAccount = await db
    .select({ id: userEmailAccounts.id, workspaceId: userEmailAccounts.workspaceId })
    .from(userEmailAccounts)
    .where(eq(userEmailAccounts.emailAddress, toEmail))
    .limit(1)

  // 2. 발신자 이메일로 리드 찾기
  const leadContactResults = await db
    .select({ leadId: leadContacts.leadId })
    .from(leadContacts)
    .where(and(
      eq(leadContacts.contactType, "email"),
      eq(leadContacts.contactValue, fromEmail)
    ))
    .limit(1)

  // 3. emails 테이블에 저장
  const inboundEmail = await db.insert(emailsTable).values({
    workspaceId: account.workspaceId,
    userEmailAccountId: account.id,
    leadId,
    direction: "inbound",
    fromEmail,
    toEmail,
    subject: body.subject || "",
    bodyText: body.text,
    bodyHtml: body.html,
    sentAt: new Date(),
    messageId: headers.messageId,
    inReplyTo: headers.inReplyTo,
  }).returning()

  // 4. 답장 처리
  if (headers.inReplyTo) {
    const originalEmail = await db
      .select()
      .from(emailsTable)
      .where(and(
        eq(emailsTable.messageId, headers.inReplyTo),
        eq(emailsTable.direction, "outbound")
      ))
      .limit(1)

    if (originalEmail) {
      await db.insert(emailReplies).values({
        workspaceId: originalEmail.workspaceId,
        originalEmailId: originalEmail.id,
        replyEmailId: inboundEmail.id,
        isRead: false,
      })
    }
  }
}
```

---

## 결론

**이메일 주소는 워크스페이스와 완전히 연동되어 있습니다:**

1. ✅ **이메일 계정 레벨**: `user_email_accounts.workspaceId`
2. ✅ **이메일 레벨**: `emails.workspaceId`
3. ✅ **리드 레벨**: `leads.workspaceId` → `lead_contacts`
4. ✅ **답장 레벨**: `email_replies.workspaceId`
5. ✅ **스레드 레벨**: `email_threads.workspaceId`

모든 이메일 관련 데이터는 워크스페이스를 기준으로 격리되고 관리됩니다.

---

## 참고 자료

- 스키마 파일: `elysia-server/src/db/schema/`
  - `workspaces.ts` - 워크스페이스
  - `email-accounts.ts` - 이메일 계정
  - `emails.ts` - 이메일, 스레드, 답장, 이벤트
  - `leads.ts` - 리드
  - `lead-details.ts` - 리드 연락처
- 웹훅 서비스: `elysia-server/src/services/webhook.service.ts`
- 웹훅 라우트: `elysia-server/src/routes/webhook.routes.ts`
