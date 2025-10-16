# Manual Migrations

이 폴더에는 수동으로 작성된 SQL 마이그레이션 파일이 포함되어 있습니다.

## 개요

- **자동 마이그레이션**: Drizzle Kit이 스키마 변경을 감지하고 자동 생성
- **Manual 마이그레이션**: 복잡한 데이터 변환, 특수한 인덱스, 또는 자동 생성이 어려운 변경사항

## 파일 규칙

```
###_description.sql
```

- **###**: 3자리 숫자 (001, 002, 003...)
- **description**: 변경사항을 설명하는 영문명
- 파일은 **숫자 순서대로** 실행됩니다

### 예시
```
001_create_workflow_emails.sql
002_add_contact_info_to_leads.sql
003_add_user_preferences.sql
```

## 실행 방법

### 권장: 통합 마이그레이션

```bash
# 프로젝트 루트에서
cd elysia-server

# Drizzle-kit + Manual 마이그레이션 모두 실행
bun run db:migrate
```

### Manual 마이그레이션만 실행

```bash
bun run db:migrate:manual
```

## 새 마이그레이션 추가

### 1. 파일 생성

```bash
cd elysia-server/src/db/manual-migrations

# 다음 번호로 파일 생성
touch 003_your_description.sql
```

### 2. SQL 작성

```sql
-- 003_your_description.sql

-- Always use IF NOT EXISTS for idempotency
ALTER TABLE your_table 
  ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_name ON your_table(new_column);

-- Add comments
COMMENT ON COLUMN your_table.new_column IS 'Description of the column';

-- Data migration (if needed)
UPDATE your_table 
SET new_column = 'default_value'
WHERE new_column IS NULL;
```

### 3. 실행

```bash
bun run db:migrate
```

## Migration History

실행된 마이그레이션은 `migration_history` 테이블에 기록됩니다:

```sql
SELECT * FROM migration_history ORDER BY executed_at DESC;
```

## Idempotent SQL 작성

항상 여러 번 실행해도 안전하도록 작성:

### ✅ Good
```sql
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_name ON leads(contact_name);
```

### ❌ Bad
```sql
ALTER TABLE leads 
  ADD COLUMN contact_name VARCHAR(255);

CREATE INDEX idx_name ON leads(contact_name);
```

## 주의사항

1. **파일명 순서**: 중간에 번호를 건너뛰지 마세요
2. **트랜잭션**: 각 마이그레이션은 트랜잭션으로 실행됩니다
3. **롤백**: 실패 시 자동 롤백되지만, 별도 롤백 스크립트 작성 권장
4. **백업**: 중요한 변경 전 데이터베이스 백업

## 트러블슈팅

### 마이그레이션 실패

1. 에러 확인:
```sql
SELECT * FROM migration_history WHERE success = FALSE;
```

2. 히스토리 삭제:
```sql
DELETE FROM migration_history WHERE filename = '003_your_file.sql';
```

3. SQL 수정 후 재실행:
```bash
bun run db:migrate
```

## 기존 마이그레이션

### 001_create_workflow_emails.sql
- workflow_generated_emails 테이블 생성
- Enum 타입 생성
- 인덱스 및 제약조건 추가

### 002_add_contact_info_to_leads.sql
- lead_contacts 테이블에 contact_name 추가
- 이메일 개인화 변수 지원

## 관련 문서

- [Manual Migrations Guide](../../../../docs/manual-migrations.md)
- [Migration Runner Code](../run-migrations.ts)

