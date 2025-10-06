# 데이터베이스 및 파일 정리 분석

## 분석 일자: 2025-10-06

최적화 작업 후 불필요하거나 중복된 리소스를 분석합니다.

---

## 1. 데이터베이스 테이블 분석

### ⚠️ 선택적으로 제거 가능한 테이블

#### A. `email_threads` 테이블

**현재 상태:**
- 정의되어 있음 (schema/emails.ts)
- 실제 사용되지 않음 (코드베이스에서 참조 없음)

**용도:**
- 이메일 스레드 메타데이터 저장
- `firstEmailId`, `lastEmailId`, `lastActivityAt` 관리

**제거 여부 판단:**

**✅ 제거 가능 (단순 구조):**
- 현재 구현에서는 `emails.threadId`로 충분
- 단일 쿼리로 스레드 조회 가능: `WHERE thread_id = ?`
- 추가 메타데이터 불필요

**⚠️ 유지 권장 (복잡한 기능):**
- 스레드 상태 관리 필요 (active, archived, snoozed)
- 스레드별 통계 필요
- 빠른 "마지막 활동" 조회 필요

**권장사항:**
```sql
-- Phase 1 (현재): 유지하되 사용하지 않음
-- Phase 2 (필요시): 스레드 관리 기능 추가 시 활용
-- Phase 3 (확실): 6개월 이상 미사용 시 제거 검토
```

---

#### B. `email_replies` 테이블

**현재 상태:**
- 정의되어 있음
- 실제 사용 중 (email-replies.service.ts, routes, webhook.service.ts)

**용도:**
- AI 분석 결과 저장 (sentiment, intent, aiSummary)
- 답장 메타데이터 (isRead, assignedTo)
- 원본-답장 관계 추적

**제거 여부 판단:**

**❌ 제거 불가:**
- 현재 활발히 사용 중
- AI 분석 기능에 필수
- 답장 관리 기능의 핵심

**최적화 제안:**
```typescript
// 비정규화로 자주 조회하는 필드 추가
ALTER TABLE emails ADD COLUMN reply_sentiment VARCHAR(50);
ALTER TABLE emails ADD COLUMN reply_is_read BOOLEAN DEFAULT false;

// email_replies는 상세 정보만 저장
// 목록 조회는 emails 테이블만 사용
```

---

### ✅ 유지해야 할 테이블

#### `email_events` 테이블
- SendGrid 웹훅 이벤트 저장
- 디버깅 및 분석에 필수
- 이벤트 추적 (open, click, bounce 등)

---

## 2. 마이그레이션 파일 분석

### 현재 마이그레이션 파일

```
migrations/
├── add_unique_constraint_customer_group_members.sql
├── add_workflow_data_to_sequences.sql
├── create_workflow_executions.sql
├── create_workflow_generated_emails.sql
├── make_customer_group_required.sql
└── optimize_emails_schema.sql (최신)
```

**상태:**
- ✅ 모두 유지 필요
- 이유: 데이터베이스 히스토리 추적 및 롤백 가능성

**정리 불필요:**
- 마이그레이션 파일은 히스토리의 일부
- 삭제하면 다른 환경에서 문제 발생 가능

---

## 3. 문서 파일 분석

### 📚 이메일 관련 문서 (중복 가능성)

#### 최신 문서 (2025-10-06 생성)
1. **EMAIL_OPTIMAL_STRATEGY.md** ⭐ 핵심
2. **EMAIL_STORAGE_STRATEGY.md**
3. **EMAIL_STORAGE_SIMPLE_STRATEGY.md**
4. **EMAIL_ACCOUNT_MANAGEMENT_STRATEGY.md**

#### 기존 문서
5. **EMAIL_HISTORY_MANAGEMENT.md**
6. **DATABASE_EMAIL_SCHEMA.md**

### 중복 분석

| 문서 | 주제 | 중복 여부 | 권장사항 |
|------|------|-----------|----------|
| EMAIL_OPTIMAL_STRATEGY.md | 최적화된 구조 | - | ✅ 유지 (최신, 가장 상세) |
| EMAIL_STORAGE_STRATEGY.md | 전체 전략 | 부분 중복 | ⚠️ 병합 검토 |
| EMAIL_STORAGE_SIMPLE_STRATEGY.md | 단순 구조 | 부분 중복 | ✅ 유지 (대안 제시) |
| EMAIL_ACCOUNT_MANAGEMENT_STRATEGY.md | 계정 관리 | - | ✅ 유지 (별도 주제) |
| EMAIL_HISTORY_MANAGEMENT.md | 이메일 히스토리 | ⚠️ 중복 | 📝 업데이트 또는 병합 |
| DATABASE_EMAIL_SCHEMA.md | DB 스키마 | ⚠️ 중복 | 📝 업데이트 필요 |

### 문서 정리 권장사항

#### 옵션 1: 병합 (권장)
```markdown
EMAIL_GUIDE.md (통합 가이드)
├── 1. 개요 및 철학 (from OPTIMAL_STRATEGY)
├── 2. 데이터베이스 스키마 (from DATABASE_EMAIL_SCHEMA + 최신 변경)
├── 3. 최적화 전략 (from OPTIMAL_STRATEGY)
├── 4. 단순화 대안 (from SIMPLE_STRATEGY)
├── 5. 계정 관리 (from ACCOUNT_MANAGEMENT_STRATEGY)
└── 6. 구현 예시 및 히스토리 (from HISTORY_MANAGEMENT)
```

#### 옵션 2: 명확한 역할 분리 (현재 유지)
```
EMAIL_OPTIMAL_STRATEGY.md      → 프로덕션 구현 가이드
EMAIL_STORAGE_SIMPLE_STRATEGY.md → MVP/시작 가이드
EMAIL_ACCOUNT_MANAGEMENT_STRATEGY.md → 계정 관리 가이드
```

**제거 가능:**
- EMAIL_STORAGE_STRATEGY.md (OPTIMAL_STRATEGY와 중복)
- EMAIL_HISTORY_MANAGEMENT.md (구식 정보, OPTIMAL_STRATEGY로 대체)
- DATABASE_EMAIL_SCHEMA.md (OPTIMAL_STRATEGY에 포함됨)

---

## 4. 기타 리소스 분석

### 서비스 파일

#### `email-replies.service.ts`
- ✅ 유지 필요
- 현재 사용 중
- AI 분석 및 답장 관리 로직

#### `webhook.service.ts`
- ✅ 유지 필요
- SendGrid 웹훅 처리
- 이벤트 저장 및 상태 업데이트

---

## 5. 정리 실행 계획

### Phase 1: 즉시 실행 가능 (안전)

```bash
# 중복 문서 제거
rm docs/EMAIL_STORAGE_STRATEGY.md
rm docs/EMAIL_HISTORY_MANAGEMENT.md
rm docs/DATABASE_EMAIL_SCHEMA.md
```

**이유:**
- EMAIL_OPTIMAL_STRATEGY.md에 모든 내용 포함
- 정보 중복으로 혼란 야기
- Git 히스토리에 남아있어 복구 가능

### Phase 2: 검토 후 실행 (신중)

#### 2.1 email_threads 테이블 제거 (선택)

**조건:**
- 6개월 이상 미사용
- 스레드 관리 기능 불필요 확인
- 백업 완료

**실행:**
```sql
-- 1. 백업
pg_dump -t email_threads > backup_email_threads.sql

-- 2. 제거
DROP TABLE email_threads CASCADE;

-- 3. 스키마 파일 수정
-- elysia-server/src/db/schema/emails.ts에서 emailThreads 정의 제거
```

#### 2.2 코드 정리

```typescript
// emails.ts에서 제거
// - emailThreads 테이블 정의
// - emailThreadsRelations 관계 정의
// - 관련 타입 export

// 관련 파일에서 import 제거
// - 어떤 파일도 현재 참조하지 않으므로 안전
```

### Phase 3: 모니터링 (지속)

```bash
# 사용하지 않는 테이블 찾기
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_tup_ins + n_tup_upd + n_tup_del ASC;

# 사용하지 않는 인덱스 찾기
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY idx_scan;
```

---

## 6. 최종 권장사항

### ✅ 즉시 제거 가능 (안전)

1. **docs/EMAIL_STORAGE_STRATEGY.md** - OPTIMAL_STRATEGY와 중복
2. **docs/EMAIL_HISTORY_MANAGEMENT.md** - 구식 정보
3. **docs/DATABASE_EMAIL_SCHEMA.md** - OPTIMAL_STRATEGY에 포함

### ⚠️ 조건부 제거 (신중)

4. **email_threads 테이블** - 현재 미사용이나 향후 필요 가능성
   - 조건: 스레드 관리 기능이 영구적으로 불필요할 경우만
   - 대안: 스키마에 유지하되 사용하지 않음 (미래 대비)

### ❌ 제거 불가

- **email_replies 테이블** - 현재 활발히 사용 중
- **email_events 테이블** - 필수 이벤트 추적
- **마이그레이션 파일** - 히스토리 추적 필요
- **서비스 파일들** - 모두 사용 중

---

## 7. 실행 체크리스트

```bash
# 1. 문서 정리 (안전)
[ ] docs/EMAIL_STORAGE_STRATEGY.md 제거
[ ] docs/EMAIL_HISTORY_MANAGEMENT.md 제거
[ ] docs/DATABASE_EMAIL_SCHEMA.md 제거
[ ] Git 커밋 및 푸시

# 2. 코드 검증 (선택)
[ ] email_threads 사용처 재확인
[ ] 6개월 사용 통계 확인
[ ] 팀과 제거 논의

# 3. 실행 (신중)
[ ] 백업 생성
[ ] email_threads 테이블 제거 (선택)
[ ] 스키마 파일 정리
[ ] 테스트 실행
```

---

## 결론

**즉시 제거 권장:**
- 3개의 중복 문서 파일 (안전)

**조건부 제거:**
- email_threads 테이블 (신중히 검토 필요)

**유지:**
- email_replies, email_events 테이블
- 모든 마이그레이션 파일
- 모든 서비스 파일
- 핵심 문서 (OPTIMAL, SIMPLE, ACCOUNT_MANAGEMENT)

**총 절약:**
- 스토리지: ~50KB (문서 3개)
- 복잡도: 중복 정보 제거로 가독성 향상
