# 이메일 저장 전략: 단순화 버전

## 개요

복잡한 스레드 관리와 추가 테이블을 최소화하고, 핵심 기능에 집중한 단순 구조를 제안합니다.

---

## 핵심 원칙

1. **하나의 메인 테이블 중심**: `emails` 테이블만 사용
2. **최소한의 추가 테이블**: 필수적인 경우에만 사용
3. **간단한 관계 설정**: `inReplyTo` 필드로 답장 연결
4. **점진적 확장**: 필요할 때만 복잡도 추가

---

## 단순화된 데이터 저장 방식

### 1. 첫 이메일 발송 (Outbound)

```typescript
// emails 테이블에만 INSERT
{
  id: uuid(),
  workspaceId: "workspace-uuid",
  userEmailAccountId: "email-account-uuid",
  leadId: "lead-uuid",

  direction: "outbound",
  fromEmail: "sales@company.com",
  toEmail: "buyer@client.com",
  subject: "Partnership Proposal",
  bodyText: "...",
  bodyHtml: "...",

  status: "draft", // → "sent" → "delivered" → "opened" → "replied"
  messageId: "<msg-123@company.com>",
  inReplyTo: null, // 첫 이메일이므로 null

  sentAt: now(),
  createdAt: now(),
  updatedAt: now(),
}
```

**끝. 추가 작업 없음.**

### 2. 답장 수신 (Inbound Parse)

```typescript
// 1. 원본 이메일 찾기 (In-Reply-To 헤더 사용)
const originalEmail = await db
  .select()
  .from(emails)
  .where(eq(emails.messageId, parsedEmail.inReplyTo))
  .limit(1)

// 2. 답장 이메일 저장
await db.insert(emails).values({
  id: uuid(),
  workspaceId: originalEmail.workspaceId,
  userEmailAccountId: originalEmail.userEmailAccountId,
  leadId: originalEmail.leadId, // 같은 lead 연결

  direction: "inbound",
  fromEmail: "buyer@client.com",
  toEmail: "sales@company.com",
  subject: "Re: Partnership Proposal",
  bodyText: "...",
  bodyHtml: "...",

  status: "replied",
  messageId: "<reply-456@client.com>",
  inReplyTo: originalEmail.messageId, // 원본 연결

  repliedAt: now(),
  createdAt: now(),
  updatedAt: now(),
})

// 3. 원본 이메일 상태 업데이트
await db.update(emails)
  .set({
    status: "replied",
    repliedAt: now(),
  })
  .where(eq(emails.id, originalEmail.id))
```

**끝. 3단계만.**

---

## 제거/단순화한 부분

### ❌ 제거: `email_threads` 테이블
- **이유**: `inReplyTo` 체인으로 충분히 추적 가능
- **대안**: 재귀 쿼리로 스레드 조회

```typescript
// 스레드가 필요하면 재귀 쿼리로 조회
WITH RECURSIVE thread AS (
  -- 첫 이메일
  SELECT * FROM emails WHERE id = 'first-email-id'
  UNION ALL
  -- 답장들
  SELECT e.* FROM emails e
  INNER JOIN thread t ON e.in_reply_to = t.message_id
)
SELECT * FROM thread ORDER BY created_at;
```

### ⚠️ 선택적: `email_replies` 테이블
- **기본**: 사용하지 않음
- **필요 시점**: AI 분석, 담당자 할당 등 고급 기능이 필요할 때만 추가

### ✅ 유지: `email_events` 테이블
- **이유**: SendGrid 웹훅 이벤트 로깅은 필수
- **용도**: opened, clicked, bounced 등 이벤트 추적

---

## 데이터 조회 쿼리 (단순 버전)

### 1. 특정 Lead의 모든 이메일 (발송 + 수신)

```typescript
const emails = await db
  .select()
  .from(emails)
  .where(eq(emails.leadId, leadId))
  .orderBy(asc(emails.createdAt))
```

### 2. 답장받은 이메일만 조회

```typescript
const repliedEmails = await db
  .select()
  .from(emails)
  .where(and(
    eq(emails.workspaceId, workspaceId),
    eq(emails.userEmailAccountId, emailAccountId),
    eq(emails.direction, "inbound"),
    eq(emails.status, "replied"),
  ))
  .orderBy(desc(emails.repliedAt))
```

### 3. 특정 이메일의 답장 찾기

```typescript
const replies = await db
  .select()
  .from(emails)
  .where(eq(emails.inReplyTo, originalEmail.messageId))
  .orderBy(asc(emails.createdAt))
```

### 4. 전체 스레드 조회 (원본 + 모든 답장)

```typescript
// 방법 1: 재귀 쿼리 (Postgres WITH RECURSIVE)
const thread = await db.execute(sql`
  WITH RECURSIVE email_thread AS (
    -- 첫 이메일 (inReplyTo가 null)
    SELECT * FROM emails
    WHERE id = ${emailId}

    UNION ALL

    -- 답장들 (재귀)
    SELECT e.* FROM emails e
    INNER JOIN email_thread et ON e.in_reply_to = et.message_id
  )
  SELECT * FROM email_thread ORDER BY created_at ASC
`)

// 방법 2: 애플리케이션 레벨에서 재귀 (간단한 경우)
async function getEmailThread(emailId: string) {
  const result = []

  // 첫 이메일
  let current = await getEmailById(emailId)
  result.push(current)

  // 답장들 찾기
  while (true) {
    const replies = await db
      .select()
      .from(emails)
      .where(eq(emails.inReplyTo, current.messageId))
      .limit(1)

    if (replies.length === 0) break

    current = replies[0]
    result.push(current)
  }

  return result
}
```

### 5. 응답률 계산

```typescript
// 발송한 이메일 수
const sentEmails = await db
  .select({ count: count() })
  .from(emails)
  .where(and(
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "outbound"),
    inArray(emails.status, ["sent", "delivered", "opened", "clicked", "replied"])
  ))

// 답장받은 이메일 수
const repliedEmails = await db
  .select({ count: count() })
  .from(emails)
  .where(and(
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "outbound"),
    eq(emails.status, "replied")
  ))

const responseRate = (repliedEmails.count / sentEmails.count) * 100
```

---

## Inbound Parse 웹훅 구현 (단순 버전)

```typescript
app.post("/webhooks/inbound-parse", async ({ body, set }) => {
  try {
    // 1. 이메일 파싱
    const parsed = parseInboundEmail(body)
    const inReplyTo = parsed.headers['In-Reply-To']

    // 2. 답장인지 확인
    if (!inReplyTo) {
      // 새로운 수신 이메일 (답장 아님)
      await saveNewEmail(parsed, "inbound", "delivered")
      return { success: true }
    }

    // 3. 원본 이메일 찾기
    const [original] = await db
      .select()
      .from(emails)
      .where(eq(emails.messageId, inReplyTo))
      .limit(1)

    if (!original) {
      // 원본 없음 (외부 이메일)
      await saveNewEmail(parsed, "inbound", "delivered")
      return { success: true }
    }

    // 4. 답장 저장
    await db.insert(emails).values({
      id: uuid(),
      workspaceId: original.workspaceId,
      userEmailAccountId: original.userEmailAccountId,
      leadId: original.leadId,
      direction: "inbound",
      fromEmail: parsed.from,
      toEmail: parsed.to,
      subject: parsed.subject,
      bodyText: parsed.text,
      bodyHtml: parsed.html,
      status: "replied",
      messageId: parsed.headers['Message-ID'],
      inReplyTo: inReplyTo,
      repliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 5. 원본 상태 업데이트
    await db.update(emails)
      .set({
        status: "replied",
        repliedAt: new Date(),
      })
      .where(eq(emails.id, original.id))

    return { success: true }

  } catch (error) {
    console.error("Inbound Parse Error:", error)
    set.status = 500
    return { success: false, error: error.message }
  }
})

// 헬퍼 함수
async function saveNewEmail(parsed: any, direction: string, status: string) {
  await db.insert(emails).values({
    id: uuid(),
    // workspaceId와 userEmailAccountId는 수신 도메인으로 찾아야 함
    workspaceId: await findWorkspaceByEmail(parsed.to),
    userEmailAccountId: await findEmailAccountByEmail(parsed.to),
    direction,
    fromEmail: parsed.from,
    toEmail: parsed.to,
    subject: parsed.subject,
    bodyText: parsed.text,
    bodyHtml: parsed.html,
    status,
    messageId: parsed.headers['Message-ID'],
    inReplyTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}
```

---

## 장단점 비교

### 👍 장점

1. **구현 간단**: 코드가 짧고 이해하기 쉬움
2. **유지보수 용이**: 테이블 관계가 단순
3. **빠른 개발**: 기능 추가가 빠름
4. **충분한 기능**: 대부분의 사용 케이스 커버

### 👎 단점

1. **스레드 조회 성능**: 재귀 쿼리가 느릴 수 있음 (이메일이 많을 때)
2. **통계 계산**: 스레드별 통계는 매번 재계산 필요
3. **확장성 제한**: 매우 복잡한 요구사항은 어려울 수 있음

---

## 성능 최적화 팁

### 1. 인덱스 추가

```sql
-- 이미 schema.ts에 있음
CREATE INDEX emails_message_id_idx ON emails(message_id);
CREATE INDEX emails_in_reply_to_idx ON emails(in_reply_to);
CREATE INDEX emails_status_idx ON emails(status);
CREATE INDEX emails_lead_id_idx ON emails(lead_id);
```

### 2. 자주 조회하는 데이터는 캐싱

```typescript
// Redis 캐싱 예시
const cacheKey = `emails:replied:${workspaceId}:${userId}`
let repliedEmails = await redis.get(cacheKey)

if (!repliedEmails) {
  repliedEmails = await db.select().from(emails)...
  await redis.set(cacheKey, JSON.stringify(repliedEmails), 'EX', 60) // 60초 캐시
}
```

### 3. 페이지네이션 필수

```typescript
// 항상 limit/offset 사용
const repliedEmails = await db
  .select()
  .from(emails)
  .where(...)
  .orderBy(desc(emails.repliedAt))
  .limit(50)  // 페이지당 50개
  .offset((page - 1) * 50)
```

---

## 점진적 확장 로드맵

### Phase 1: 기본 (현재)
- ✅ `emails` 테이블만 사용
- ✅ 발송 + 수신 기본 기능

### Phase 2: 필요 시 추가
- ⚠️ `email_threads` 테이블 추가 (스레드 조회가 느릴 때)
- ⚠️ `email_replies` 테이블 추가 (AI 분석 필요할 때)

### Phase 3: 고급 기능
- 📊 실시간 통계 대시보드
- 🤖 AI 자동 분류 및 응답
- 👥 팀 협업 기능 (담당자 할당, 댓글 등)

---

## 권장 구현 순서

### 1단계: 발송 기능 완성
```
[ ] 이메일 발송 API
[ ] SendGrid 연동
[ ] 발송 상태 업데이트 (sent, delivered)
[ ] 웹훅으로 opened/clicked 추적
```

### 2단계: 수신 기능 추가
```
[ ] Inbound Parse 설정
[ ] 웹훅 엔드포인트 구현
[ ] 답장 이메일 저장
[ ] 원본 이메일 상태 업데이트
```

### 3단계: UI 완성
```
[ ] 발송 이메일 목록
[ ] 답장 이메일 목록 (이미 완성)
[ ] 이메일 상세 보기
[ ] 스레드 뷰 (선택)
```

### 4단계: 최적화
```
[ ] 인덱스 최적화
[ ] 쿼리 성능 측정
[ ] 캐싱 적용
[ ] 모니터링 추가
```

---

## 결론

**이 단순 구조로 충분한 경우:**
- Lead당 이메일 수가 적을 때 (< 100개)
- 스레드 뷰가 필수가 아닐 때
- 빠른 MVP 개발이 목표일 때
- 팀이 작고 요구사항이 단순할 때

**복잡한 구조가 필요한 경우:**
- Lead당 이메일 수가 많을 때 (> 100개)
- 복잡한 스레드 관리가 필요할 때
- AI 분석, 협업 기능 등 고급 기능이 필요할 때
- 대규모 트래픽 처리가 필요할 때

**추천:** 단순 구조로 시작하고, 필요할 때 점진적으로 복잡도를 추가하세요.
