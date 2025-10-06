# 답장관리 화면 백엔드 API 분석

## 개요

답장관리 화면(`/replied-emails`)에서 사용하는 백엔드 API 엔드포인트에 대한 상세 분석 문서입니다.

---

## 1. 주요 엔드포인트

### 1.1 답장 이메일 검색 API

**엔드포인트**: `GET /api/v1/emails/search-replied`

**파일 위치**: `/elysia-server/src/routes/emails.routes.ts:598-713`

#### 요청 (Query Parameters)

| 파라미터 | 타입 | 필수 여부 | 기본값 | 설명 |
|---------|------|----------|--------|------|
| `workspaceId` | UUID String | 필수 | - | 워크스페이스 ID |
| `limit` | String (숫자) | 선택 | "20" | 한 페이지당 항목 수 |
| `offset` | String (숫자) | 선택 | "0" | 페이지네이션 오프셋 |
| `status` | String | 선택 | - | 이메일 상태 필터 (delivered, opened, clicked, replied, bounced, failed) |
| `leadId` | UUID String | 선택 | - | 특정 리드의 이메일만 조회 |
| `sequenceId` | UUID String | 선택 | - | 특정 시퀀스의 이메일만 조회 |
| `search` | String | 선택 | - | 제목, 발신자 이메일, 리드명 검색 |

#### 응답 형식

```typescript
{
  data: Array<{
    id: string                    // 이메일 ID (UUID)
    fromEmail: string             // 발신자 이메일
    toEmail: string               // 수신자 이메일
    subject: string | null        // 이메일 제목
    bodyText: string | null       // 텍스트 본문
    bodyHtml: string | null       // HTML 본문
    status: EmailStatus           // 상태 (delivered, opened, clicked, replied 등)
    repliedAt: Date | null        // 답장 시간
    deliveredAt: Date | null      // 전달 시간
    openedAt: Date | null         // 오픈 시간
    inReplyTo: string | null      // 답장 대상 메시지 ID
    threadId: string | null       // 스레드 ID
    leadId: string | null         // 리드 ID
    sequenceId: string | null     // 시퀀스 ID
    createdAt: Date               // 생성 시간
    updatedAt: Date               // 업데이트 시간
    // Denormalized fields (JOIN 없이 빠른 조회)
    leadName: string | null       // 리드 이름
    leadEmail: string | null      // 리드 이메일
    sequenceName: string | null   // 시퀀스 이름
  }>,
  total: number,                  // 전체 항목 수
  limit: number,                  // 요청한 limit 값
  offset: number                  // 요청한 offset 값
}
```

#### 동작 방식

1. **기본 필터링**:
   - `workspaceId`와 `direction = 'inbound'` 조건은 항상 적용
   - 답장 이메일만 조회 (inbound emails)

2. **조건부 필터링**:
   ```typescript
   // 상태 필터 (status가 'all'이 아닌 경우만)
   if (statusFilter && statusFilter !== "all") {
     conditions.push(eq(emails.status, statusFilter))
   }

   // 리드 필터
   if (leadIdFilter) {
     conditions.push(eq(emails.leadId, leadIdFilter))
   }

   // 시퀀스 필터
   if (sequenceIdFilter) {
     conditions.push(eq(emails.sequenceId, sequenceIdFilter))
   }

   // 검색 (제목, 발신자 이메일, 리드명)
   if (searchFilter) {
     conditions.push(or(
       ilike(emails.subject, `%${searchFilter}%`),
       ilike(emails.fromEmail, `%${searchFilter}%`),
       ilike(emails.leadName, `%${searchFilter}%`)
     ))
   }
   ```

3. **정렬**: `createdAt` 기준 내림차순 (최신순)

4. **페이지네이션**: `limit`과 `offset` 사용

5. **성능 최적화**:
   - JOIN 없이 denormalized fields 사용 (`leadName`, `leadEmail`, `sequenceName`)
   - 카운트 쿼리는 별도 실행

#### 예시 요청

```bash
# 기본 조회 (첫 페이지)
GET /api/v1/emails/search-replied?workspaceId=5ed0fc57-1cf8-4d2f-894b-78509e1a0880&limit=20&offset=0

# 상태 필터 적용
GET /api/v1/emails/search-replied?workspaceId=5ed0fc57-1cf8-4d2f-894b-78509e1a0880&status=replied&limit=20&offset=0

# 검색 적용
GET /api/v1/emails/search-replied?workspaceId=5ed0fc57-1cf8-4d2f-894b-78509e1a0880&search=meeting&limit=20&offset=0

# 2페이지 조회
GET /api/v1/emails/search-replied?workspaceId=5ed0fc57-1cf8-4d2f-894b-78509e1a0880&limit=20&offset=20
```

---

## 2. 프론트엔드 통합

### 2.1 API Service Layer

**파일**: `/admin/src/lib/api/services/emails.ts:104-142`

```typescript
searchRepliedEmails: (params: {
  workspaceId: string
  page?: number
  limit?: number
  status?: string
  leadId?: string
  sequenceId?: string
  search?: string
}) => {
  const searchParams = new URLSearchParams()

  const page = params.page || 1
  const limit = params.limit || 20
  const offset = (page - 1) * limit

  searchParams.append("workspaceId", params.workspaceId)
  searchParams.append("limit", limit.toString())
  searchParams.append("offset", offset.toString())

  if (params.status && params.status !== "all")
    searchParams.append("status", params.status)
  if (params.leadId)
    searchParams.append("leadId", params.leadId)
  if (params.sequenceId)
    searchParams.append("sequenceId", params.sequenceId)
  if (params.search)
    searchParams.append("search", params.search)

  const query = searchParams.toString()
  return apiFetch<ResponseType>(`/api/v1/emails/search-replied?${query}`)
    .then((response) => ({
      repliedEmails: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
}
```

**주요 변환**:
- `page` → `offset` 변환 (`offset = (page - 1) * limit`)
- 응답 데이터에 `totalPages` 계산 추가

### 2.2 React Query Hook

**파일**: `/admin/src/lib/api/hooks/emails.ts:147-165`

```typescript
export interface RepliedEmailsParams {
  workspaceId: string
  page?: number
  limit?: number
  status?: string
  leadId?: string
  sequenceId?: string
  search?: string
}

export function useRepliedEmails(params: RepliedEmailsParams) {
  return useQuery({
    queryKey: ["replied-emails", params],
    queryFn: () => emailsApi.searchRepliedEmails(params),
    enabled: !!params.workspaceId,
    staleTime: 30 * 1000,      // 30초 동안 fresh
    gcTime: 5 * 60 * 1000,     // 5분 동안 캐시 유지
  })
}
```

**캐싱 전략**:
- Query Key: `["replied-emails", params]` - 파라미터별로 캐시 분리
- `enabled`: workspace ID가 있을 때만 실행
- `staleTime`: 30초 - 같은 파라미터로 재요청 시 캐시 사용
- `gcTime`: 5분 - 사용하지 않는 캐시는 5분 후 제거

### 2.3 컴포넌트 사용

**파일**: `/admin/src/pages/email-replies/RepliedEmailsTableWithPagination.tsx:15-43`

```typescript
export function RepliedEmailsTableWithPagination({
  workspaceId,
  searchQuery,
  selectedStatuses,
}: RepliedEmailsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  // Build params for API call
  const params: RepliedEmailsParams = {
    workspaceId,
    page: currentPage,
    limit: limit,
    status:
      selectedStatuses.length === 1
        ? selectedStatuses[0]
        : selectedStatuses.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
  }

  // Use React Query hook
  const { data, isFetching } = useRepliedEmails(params)
  const repliedEmails = data?.repliedEmails || []
  const totalPages = data?.totalPages || 1
  const total = data?.total || 0

  // ... render table
}
```

**상태 필터 로직**:
- 상태 1개 선택: 해당 상태로 필터링
- 상태 2개 이상 선택: `"all"` (백엔드에서 필터링하지 않음)
- 상태 미선택: `undefined` (백엔드에서 필터링하지 않음)

---

## 3. 데이터베이스 구조

### 3.1 주요 테이블

#### emails 테이블

```sql
CREATE TABLE emails (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_email_account_id UUID NOT NULL REFERENCES user_email_accounts(id),
  direction VARCHAR NOT NULL,  -- 'inbound' | 'outbound'
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,
  status VARCHAR NOT NULL,
  thread_id VARCHAR,
  in_reply_to VARCHAR,

  -- Relationships
  lead_id UUID REFERENCES leads(id),
  sequence_id UUID REFERENCES sequences(id),

  -- Denormalized fields (성능 최적화)
  lead_name VARCHAR(255),
  lead_email VARCHAR(255),
  sequence_name VARCHAR(255),

  -- Timestamps
  replied_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_emails_workspace_direction
  ON emails(workspace_id, direction);
CREATE INDEX idx_emails_status
  ON emails(status);
CREATE INDEX idx_emails_created_at
  ON emails(created_at DESC);
```

### 3.2 Denormalized Fields 사용 이유

**성능 최적화**:
```sql
-- ❌ 기존 방식 (JOIN 필요)
SELECT e.*, l.name as lead_name, s.name as sequence_name
FROM emails e
LEFT JOIN leads l ON e.lead_id = l.id
LEFT JOIN sequences s ON e.sequence_id = s.id
WHERE e.workspace_id = ? AND e.direction = 'inbound'

-- ✅ 현재 방식 (JOIN 불필요)
SELECT e.*, e.lead_name, e.sequence_name
FROM emails e
WHERE e.workspace_id = ? AND e.direction = 'inbound'
```

**장점**:
- 쿼리 성능 향상 (JOIN 제거)
- 응답 시간 단축
- 데이터베이스 부하 감소

**단점**:
- 데이터 중복
- 리드/시퀀스 이름 변경 시 동기화 필요

---

## 4. 데이터 플로우

### 4.1 전체 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 사용자 액션                                                   │
│    - 워크스페이스 선택                                           │
│    - 상태 필터 선택                                              │
│    - 검색어 입력                                                 │
│    - 페이지 이동                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. React Component (EmailRepliesPage)                          │
│    - searchInput, selectedStatuses 상태 관리                   │
│    - 300ms debounce 적용                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Table Component (RepliedEmailsTableWithPagination)         │
│    - params 객체 생성                                          │
│    - useRepliedEmails(params) 호출                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. React Query Hook (useRepliedEmails)                        │
│    - 캐시 확인 (queryKey 기준)                                 │
│    - 캐시 없거나 stale하면 API 요청                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. API Service (emailsApi.searchRepliedEmails)                │
│    - page → offset 변환                                        │
│    - URLSearchParams 생성                                      │
│    - apiFetch() 호출                                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. HTTP Request                                                │
│    GET /api/v1/emails/search-replied?workspaceId=...&limit=... │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Elysia Backend (emails.routes.ts)                          │
│    - Query params 파싱                                         │
│    - 조건 빌드 (workspace, direction, filters)                 │
│    - Drizzle ORM 쿼리 실행                                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. PostgreSQL Database                                         │
│    - emails 테이블 조회                                         │
│    - WHERE, ORDER BY, LIMIT, OFFSET 적용                       │
│    - COUNT(*) 쿼리 실행                                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Response 처리                                                │
│    - Service: totalPages 계산                                  │
│    - React Query: 캐시 저장                                    │
│    - Component: UI 업데이트                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 캐싱 동작

```typescript
// 같은 파라미터로 재요청 시
useRepliedEmails({
  workspaceId: "abc",
  page: 1,
  status: "replied"
})

// 30초 이내: 캐시된 데이터 즉시 반환 (네트워크 요청 없음)
// 30초 이후: 백그라운드에서 재요청 + 이전 캐시 표시

// 다른 파라미터로 요청 시
useRepliedEmails({
  workspaceId: "abc",
  page: 2,           // 변경됨
  status: "replied"
})

// 새 캐시 엔트리 생성 + 네트워크 요청
```

---

## 5. 주요 기능

### 5.1 다중 상태 필터

**UI**: 체크박스로 여러 상태 선택 가능

**동작**:
```typescript
// 선택된 상태: ["delivered", "opened"]
const params = {
  status: selectedStatuses.length === 1
    ? selectedStatuses[0]  // "delivered"
    : "all"                // 2개 이상이면 "all"
}

// 백엔드에서 "all"은 필터링하지 않음
if (statusFilter && statusFilter !== "all") {
  conditions.push(eq(emails.status, statusFilter))
}
```

### 5.2 검색 (Search)

**검색 대상**:
- 이메일 제목 (`emails.subject`)
- 발신자 이메일 (`emails.fromEmail`)
- 리드 이름 (`emails.leadName`)

**구현**:
```typescript
// 백엔드
or(
  ilike(emails.subject, `%${searchFilter}%`),
  ilike(emails.fromEmail, `%${searchFilter}%`),
  ilike(emails.leadName, `%${searchFilter}%`)
)
```

**Debounce**:
- 프론트엔드에서 300ms 디바운스 적용
- 타이핑 중에는 API 호출 방지

### 5.3 페이지네이션

**구현 방식**: Offset-based pagination

**계산**:
```typescript
// 프론트엔드
const page = 1
const limit = 20
const offset = (page - 1) * limit  // 0

// 2페이지
const page = 2
const offset = (page - 1) * 20  // 20

// 총 페이지 수
const totalPages = Math.ceil(total / limit)
```

**UI 기능**:
- 처음/이전/다음/마지막 버튼
- 페이지 번호 버튼 (최대 5개 표시)
- 페이지 직접 입력 (Page Jump)

---

## 6. 에러 처리

### 6.1 Workspace 없음

```typescript
if (!workspaceId) {
  return {
    data: [],
    total: 0,
    limit,
    offset,
  }
}
```

**UI**: 빈 테이블 표시

### 6.2 네트워크 에러

**React Query 자동 처리**:
- 3회 자동 재시도
- 에러 상태를 컴포넌트에 전달

```typescript
const { data, isFetching, error } = useRepliedEmails(params)

if (error) {
  // 에러 UI 표시
}
```

---

## 7. 성능 최적화

### 7.1 Denormalized Fields

- `leadName`, `sequenceName` 등을 emails 테이블에 저장
- JOIN 쿼리 제거로 성능 향상

### 7.2 인덱스

```sql
-- 복합 인덱스: 가장 자주 사용하는 조건
CREATE INDEX idx_emails_workspace_direction
  ON emails(workspace_id, direction);

-- 상태 필터 인덱스
CREATE INDEX idx_emails_status
  ON emails(status);

-- 정렬 인덱스
CREATE INDEX idx_emails_created_at
  ON emails(created_at DESC);
```

### 7.3 React Query 캐싱

- 같은 파라미터 요청 시 캐시 사용
- 불필요한 API 호출 방지
- 페이지 전환 시 즉시 표시

### 7.4 Debounce

- 검색어 입력 시 300ms 디바운스
- 타이핑 중 과도한 API 호출 방지

---

## 8. 보안 고려사항

### 8.1 Workspace 격리

```typescript
// 항상 workspaceId 필터 적용
conditions = [
  eq(emails.workspaceId, workspaceId),
  eq(emails.direction, "inbound"),
]
```

**효과**:
- 다른 워크스페이스의 데이터 접근 불가
- 권한 있는 워크스페이스 데이터만 조회

### 8.2 입력 검증

```typescript
// Elysia Type Validation
query: t.Object({
  workspaceId: t.String({ format: "uuid" }),
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String()),
  status: t.Optional(t.String()),
  leadId: t.Optional(t.String({ format: "uuid" })),
  sequenceId: t.Optional(t.String({ format: "uuid" })),
  search: t.Optional(t.String()),
})
```

**효과**:
- UUID 형식 검증
- 잘못된 타입 요청 차단

---

## 9. 향후 개선 가능 사항

### 9.1 Cursor-based Pagination

**현재**: Offset-based
```typescript
// 문제: 대량 데이터에서 offset이 클 때 성능 저하
SELECT * FROM emails LIMIT 20 OFFSET 10000
```

**개선**: Cursor-based
```typescript
// 장점: 일관된 성능
SELECT * FROM emails
WHERE created_at < :cursor
ORDER BY created_at DESC
LIMIT 20
```

### 9.2 Full-text Search

**현재**: `ILIKE '%search%'`
```sql
-- 성능 제한: 인덱스 사용 불가
WHERE subject ILIKE '%meeting%'
```

**개선**: PostgreSQL Full-text Search
```sql
-- 성능 향상: GIN 인덱스 사용
WHERE to_tsvector('english', subject) @@ to_tsquery('meeting')
```

### 9.3 실시간 업데이트

**현재**: 폴링 방식 (staleTime 30초)

**개선**: WebSocket 또는 Server-Sent Events
- 새 답장 실시간 알림
- 자동 UI 업데이트

---

## 10. 관련 파일

### Backend
- `/elysia-server/src/routes/emails.routes.ts` - API 엔드포인트
- `/elysia-server/src/db/schema/emails.ts` - 데이터베이스 스키마

### Frontend
- `/admin/src/pages/email-replies/EmailRepliesPage.tsx` - 메인 페이지
- `/admin/src/pages/email-replies/RepliedEmailsTableWithPagination.tsx` - 테이블 컴포넌트
- `/admin/src/pages/email-replies/RepliedEmailFilters.tsx` - 필터 컴포넌트
- `/admin/src/lib/api/services/emails.ts` - API 서비스
- `/admin/src/lib/api/hooks/emails.ts` - React Query 훅
- `/admin/src/lib/api/types/email.ts` - TypeScript 타입 정의

---

## 11. 결론

답장관리 화면의 백엔드 API는 다음과 같은 특징을 가집니다:

✅ **단순하고 효율적인 구조**
- Users 페이지 패턴 참고
- 명확한 필터링 및 페이지네이션

✅ **성능 최적화**
- Denormalized fields로 JOIN 제거
- 적절한 인덱스 설정
- React Query 캐싱

✅ **확장 가능한 설계**
- 새로운 필터 추가 용이
- 타입 안전성 보장 (TypeScript + Elysia)

✅ **보안**
- Workspace 격리
- 입력 검증

이 구조는 중소 규모의 데이터에서 안정적으로 동작하며, 향후 트래픽 증가 시 Cursor-based pagination이나 Full-text search 등으로 추가 최적화가 가능합니다.
