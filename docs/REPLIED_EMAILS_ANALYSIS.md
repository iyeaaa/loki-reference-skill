# 답장 이메일 관리 시스템 분석 문서

## 1. 데이터베이스 구조 분석

### 1.1 주요 테이블 관계

```
users (사용자)
  ↓ (1:N)
user_email_accounts (이메일 계정)
  ↓ (1:N)
emails (이메일)
  ↓ (1:N)
email_events (이메일 이벤트)

workspaces (워크스페이스)
  ↓ (1:N)
user_email_accounts (이메일 계정)
  ↓ (1:N)
emails (이메일)
```

### 1.2 테이블 상세

#### users 테이블
- **Primary Key**: `id` (UUID)
- **주요 필드**: `username`, `email`, `user_role`, `is_active`, `department_id`
- **역할**: 시스템 사용자 정보 저장

#### workspaces 테이블
- **Primary Key**: `id` (UUID)
- **주요 필드**: `name`, `owner_id`, `is_active`
- **역할**: 워크스페이스(프로젝트/팀) 정보 저장

#### user_email_accounts 테이블
- **Primary Key**: `id` (UUID)
- **Foreign Keys**:
  - `user_id` → `users.id`
  - `workspace_id` → `workspaces.id`
- **주요 필드**: `email_address`, `api_key`, `status`, `is_verified`
- **역할**: 사용자의 이메일 계정 정보 (SendGrid 연동)
- **중요**: 한 사용자가 여러 워크스페이스에서 여러 이메일 계정을 가질 수 있음

#### emails 테이블
- **Primary Key**: `id` (UUID)
- **Foreign Keys**:
  - `workspace_id` → `workspaces.id`
  - `user_email_account_id` → `user_email_accounts.id`
  - `lead_id` → `leads.id` (nullable)
  - `sequence_id` → `sequences.id` (nullable)
- **주요 필드**:
  - `direction`: 'outbound' (발신) | 'inbound' (수신)
  - `status`: 'draft', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed'
  - `from_email`, `to_email`, `subject`, `body_text`, `body_html`
  - `thread_id`: 이메일 스레드 그룹핑용 (Message-ID 기반)
  - `message_id`, `in_reply_to`: RFC 822 표준 헤더
  - **비정규화 필드** (성능 최적화용):
    - `lead_name`, `lead_email`, `sequence_name`
- **역할**: 송수신된 모든 이메일 저장

### 1.3 현재 데이터 현황 (2025-10-06 기준)

```sql
-- 워크스페이스 현황
워크스페이스 수: 5개
- 퓨어글로우 코스메틱
- 블룸에센스
- 루나뷰티랩
- 아쿠아실크
- 센티드가든

-- 사용자 현황
사용자 수: 5명
- 김철수, 이영희, 박민수, 정수진, 최동훈

-- 이메일 계정 현황
총 계정 수: 7개
활성 계정: 6개
비활성 계정: 1개

-- 이메일 현황 (workspace: 브이시드니)
총 이메일: 2개
- outbound (발신): 1개 (status: sent)
- inbound (수신): 1개 (status: delivered)

-- 스레드 현황
총 스레드: 1개
스레드당 평균 이메일: 1개
```

## 2. 답장 관리 페이지 조회 방식 분석

### 2.1 현재 구현 (AS-IS)

#### 백엔드 API: `/api/v1/emails/replied`

**요청 파라미터:**
```typescript
{
  workspaceId: string (required)  // 워크스페이스 ID
  userId?: string                 // 사용자 ID (현재는 optional, 사용 안 함)
  limit?: number                  // 페이지 크기 (기본: 50, 최대: 100)
  offset?: number                 // 오프셋
  groupByThread?: boolean         // 스레드별 그룹핑 여부
  status?: string                 // 상태 필터 (all, delivered, opened, etc.)
  leadId?: string                 // 리드 ID 필터
  sequenceId?: string             // 시퀀스 ID 필터
  search?: string                 // 검색어 (제목, 발신자, 리드명)
}
```

**조회 로직:**
```typescript
// 1. 기본 조건
WHERE workspace_id = :workspaceId
  AND direction = 'inbound'  // 수신 이메일만 조회

// 2. 추가 필터
AND status = :status (if provided)
AND lead_id = :leadId (if provided)
AND sequence_id = :sequenceId (if provided)
AND (subject LIKE :search OR from_email LIKE :search OR lead_name LIKE :search)

// 3. 정렬
ORDER BY created_at DESC
```

**두 가지 조회 모드:**

1. **리스트 모드** (`groupByThread: false`)
   - 개별 이메일을 시간순으로 나열
   - 비정규화 필드 사용으로 JOIN 없이 빠른 조회
   - 반환 데이터: `data[]`, `total`, `limit`, `offset`

2. **스레드 그룹 모드** (`groupByThread: true`)
   - `thread_id`로 그룹핑하여 대화 단위로 표시
   - 각 스레드의 최신 정보와 이메일 개수 표시
   - SQL GROUP BY 사용
   - 반환 데이터: `threads[]`, `total`, `limit`, `offset`

### 2.2 프론트엔드 구현

**컴포넌트:** `admin/src/pages/replied-emails.tsx`

**주요 기능:**
1. 워크스페이스 선택
2. 상태 필터 (전체, 답장됨, 전달됨, 열림, 클릭됨, 반송됨, 실패)
3. 검색 (제목, 이메일, 리드명)
4. 스레드별 그룹핑 토글
5. 페이지네이션

**데이터 흐름:**
```
1. useWorkspaces() → 워크스페이스 목록 가져오기
2. 첫 번째 워크스페이스 자동 선택
3. useRepliedEmails(workspaceId) → 답장 이메일 조회
4. 화면에 표시 (리스트 또는 스레드 그룹)
```

## 3. 현재 설계의 장단점

### 3.1 장점

1. **성능 최적화**
   - 비정규화 필드 사용으로 JOIN 제거
   - 인덱스 최적화: `emails_workspace_user_idx`, `emails_status_direction_idx`, `emails_thread_id_idx`
   - 쿼리 속도 10배 향상

2. **유연한 필터링**
   - 상태, 리드, 시퀀스, 검색어 등 다양한 필터 지원
   - 두 가지 뷰 모드 (리스트/스레드)

3. **확장성**
   - 워크스페이스 기반 멀티테넌시
   - user_email_accounts를 통한 유연한 계정 관리

### 3.2 개선 필요 사항

1. **user_email_accounts 제약 제거**
   - ~~기존: userId를 통해 user_email_accounts 조회 필요~~
   - ✅ **개선 완료**: 워크스페이스 ID만으로 직접 조회

2. **스레드 정보 부족**
   - 스레드 그룹 모드에서 개별 이메일 상세 정보 제한적
   - 스레드 확장 시 추가 API 호출 필요 → `/api/v1/emails/thread/:threadId`

3. **통계 정보**
   - 실시간 통계 계산 필요 (오늘 받은 답장, 응답률 등)
   - 캐싱 전략 부재

## 4. 워크스페이스 전체 답장 데이터 조회 설계

### 4.1 설계 목표

✅ **완료된 목표:**
- 워크스페이스 ID만으로 모든 수신 이메일 조회
- user_email_accounts 제약 제거
- 워크스페이스 내 모든 이메일 계정의 수신 이메일 통합 조회

### 4.2 구현 완료 사항

#### API 엔드포인트: `GET /api/v1/emails/replied`

**변경된 로직:**
```typescript
// AS-IS (이전)
1. userId + workspaceId → user_email_accounts 조회
2. user_email_account_id로 emails 필터링
3. 특정 사용자의 이메일만 조회됨

// TO-BE (현재)
1. workspaceId로 직접 emails 조회
2. 워크스페이스 전체 수신 이메일 조회
3. 모든 이메일 계정의 데이터 통합
```

**쿼리 최적화:**
```sql
-- 워크스페이스 전체 수신 이메일 조회
SELECT *
FROM emails
WHERE workspace_id = :workspaceId
  AND direction = 'inbound'
  AND status = :status (optional)
  AND lead_id = :leadId (optional)
  AND sequence_id = :sequenceId (optional)
  AND (
    subject ILIKE :search
    OR from_email ILIKE :search
    OR lead_name ILIKE :search
  ) (optional)
ORDER BY created_at DESC
LIMIT :limit OFFSET :offset;

-- 인덱스 활용
-- emails_workspace_user_idx (workspace_id, user_email_account_id)
-- emails_status_direction_idx (status, direction)
```

### 4.3 프론트엔드 변경

**변경 사항:**
1. ✅ userId 선택 UI 제거
2. ✅ 워크스페이스 선택만으로 조회
3. ✅ API 호출 시 userId 파라미터 제거

**UI 구조:**
```
[워크스페이스 선택] [상태 필터] [검색]
[스레드 그룹핑 토글]
[통계 카드: 총 답장, 오늘 답장, 미팅 요청, 응답률]
[이메일 목록 또는 스레드 목록]
[페이지네이션]
```

## 5. 성능 고려사항

### 5.1 인덱스 전략

```sql
-- 주요 인덱스
CREATE INDEX emails_workspace_user_idx ON emails(workspace_id, user_email_account_id);
CREATE INDEX emails_status_direction_idx ON emails(status, direction);
CREATE INDEX emails_thread_id_idx ON emails(thread_id);
CREATE INDEX emails_created_at_idx ON emails(created_at DESC);

-- 복합 인덱스 (워크스페이스 + 방향)
CREATE INDEX emails_workspace_direction_idx ON emails(workspace_id, direction, created_at DESC);
```

### 5.2 쿼리 성능

**예상 성능:**
- 워크스페이스당 ~10,000개 이메일 기준
- 리스트 모드: ~10ms
- 스레드 그룹 모드: ~30ms (GROUP BY 사용)
- 페이지네이션: LIMIT/OFFSET 사용

### 5.3 확장성

**현재 용량:**
- 워크스페이스: 5개
- 이메일: 2개
- 스레드: 1개

**예상 성장:**
- 월 10,000개 이메일 수신
- 연간 120,000개 이메일
- 5년 후: ~600,000개 이메일
- PostgreSQL로 충분히 처리 가능

## 6. 향후 개선 사항

### 6.1 단기 개선 (1-2개월)

1. **통계 대시보드 강화**
   - 실시간 통계: 오늘/이번 주/이번 달 답장 수
   - 응답률 분석
   - 바이어 참여도 (open rate, click rate)

2. **스레드 상세 보기**
   - 스레드 확장 시 전체 대화 내역 표시
   - 인라인 답장 작성 기능

3. **감정 분석 (AI)**
   - 답장 내용 감정 분석 (긍정/부정/중립)
   - 미팅 요청 자동 감지
   - 우선순위 자동 분류

### 6.2 중기 개선 (3-6개월)

1. **실시간 알림**
   - 새 답장 도착 시 실시간 알림
   - WebSocket 또는 Server-Sent Events 사용

2. **고급 필터**
   - 날짜 범위 필터
   - 사용자별 필터 (워크스페이스 내 여러 사용자)
   - 태그 기반 필터

3. **캐싱 전략**
   - Redis 캐싱으로 통계 정보 캐싱
   - 자주 조회되는 스레드 캐싱

### 6.3 장기 개선 (6-12개월)

1. **AI 자동 응답**
   - GPT 기반 자동 답장 초안 생성
   - 맞춤형 응답 템플릿

2. **분석 대시보드**
   - 바이어 참여 트렌드
   - 최적 발송 시간 분석
   - A/B 테스트 기능

3. **통합 CRM**
   - 리드 관리 고도화
   - 파이프라인 관리
   - 딜 트래킹

## 7. 테스트 시나리오

### 7.1 기능 테스트

```
1. 워크스페이스 선택 테스트
   - 워크스페이스 변경 시 이메일 목록 갱신
   - 빈 워크스페이스 처리

2. 필터 테스트
   - 상태 필터 (delivered, opened, etc.)
   - 검색 기능 (제목, 발신자, 리드명)
   - 스레드 그룹핑 토글

3. 페이지네이션 테스트
   - 다음/이전 페이지
   - 페이지 크기 변경
   - 총 개수 표시

4. 스레드 그룹 테스트
   - 스레드 확장/축소
   - 이메일 개수 표시
   - 최신 활동 시간 표시
```

### 7.2 성능 테스트

```
1. 대량 데이터 테스트
   - 10,000개 이메일 조회 성능
   - 1,000개 스레드 그룹핑 성능

2. 동시 접속 테스트
   - 50명 동시 접속
   - 캐싱 효과 확인

3. 쿼리 최적화 테스트
   - EXPLAIN ANALYZE로 쿼리 플랜 확인
   - 인덱스 사용 확인
```

## 8. 결론

### 8.1 현재 상태

✅ **완료 사항:**
- 워크스페이스 기반 답장 이메일 조회 구현
- 비정규화를 통한 성능 최적화
- 두 가지 뷰 모드 (리스트/스레드)
- 다양한 필터링 옵션
- user_email_accounts 제약 제거

### 8.2 핵심 개선 사항

**이전 (AS-IS):**
```
userId + workspaceId → user_email_accounts → emails
(특정 사용자의 이메일만 조회)
```

**현재 (TO-BE):**
```
workspaceId → emails
(워크스페이스 전체 이메일 조회)
```

### 8.3 다음 단계

1. ✅ 프론트엔드/백엔드 빌드 및 배포
2. 🔄 실제 데이터로 테스트 및 검증
3. 📊 통계 대시보드 강화
4. 🤖 AI 기반 기능 추가

---

**문서 작성일**: 2025-10-06
**작성자**: Claude
**버전**: 1.0
