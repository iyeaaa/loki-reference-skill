# Drizzle ORM 마이그레이션 가이드

## 📋 목차
1. [개요](#개요)
2. [마이그레이션 방식](#마이그레이션-방식)
3. [수동 마이그레이션 실행 방법](#수동-마이그레이션-실행-방법)
4. [Drizzle Kit 명령어](#drizzle-kit-명령어)
5. [마이그레이션 워크플로우](#마이그레이션-워크플로우)
6. [프로덕션 배포](#프로덕션-배포)
7. [트러블슈팅](#트러블슈팅)

---

## 개요

이 프로젝트는 **Drizzle ORM**을 사용하여 데이터베이스 스키마를 관리합니다.

### 주요 특징
- ✅ TypeScript 스키마 우선 접근 방식
- ✅ SQL 마이그레이션 파일 자동 생성
- ✅ **수동 마이그레이션 실행** (자동 실행 비활성화)
- ✅ 수동 SQL 마이그레이션 지원 (`src/db/manual-migrations/`)

### 중요 사항
- 🚨 **마이그레이션은 자동으로 실행되지 않습니다**
- 🚨 **개발자가 직접 `bun run db:push` 또는 `bun run db:migrate` 실행 필요**
- 🚨 **Docker 컨테이너 시작 시 마이그레이션 자동 실행 안 함**

---

## 마이그레이션 방식

### 1. Drizzle Kit 명령어 사용 (권장)

```bash
# 방법 A: Push (빠른 개발, 마이그레이션 파일 없음)
bun run db:push

# 방법 B: Generate + Migrate (프로덕션 권장, 마이그레이션 파일 생성)
bun run db:generate
bun run db:migrate
```

### 2. 수동 SQL 마이그레이션

복잡한 데이터 변환이나 커스텀 SQL이 필요한 경우:

**파일 위치:** `src/db/manual-migrations/`

**파일명 규칙:** `001_description.sql`, `002_description.sql`

**예시:**
```sql
-- src/db/manual-migrations/001_create_workflow_emails.sql

DO $$ BEGIN
  CREATE TYPE workflow_email_status_enum AS ENUM ('pending', 'generating', 'generated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS workflow_generated_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 수동 마이그레이션 실행 방법

### 로컬 개발 환경

#### 1. 환경 변수 설정

```bash
# .env 파일 확인
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres
```

#### 2. 데이터베이스 연결 확인

```bash
# PostgreSQL 실행 확인 (Docker 사용 시)
docker ps -a | grep postgres

# 또는 직접 연결 테스트
psql -h localhost -U postgres -d postgres
```

#### 3. 마이그레이션 실행

**옵션 A: Push (빠른 개발)**
```bash
bun run db:push
```
- 스키마 변경사항을 즉시 데이터베이스에 반영
- 마이그레이션 파일 생성 안 함
- 개발 환경에서만 사용 권장

**옵션 B: Generate + Migrate (프로덕션 권장)**
```bash
# 1. 마이그레이션 파일 생성
bun run db:generate

# 2. 생성된 SQL 파일 확인
ls -la drizzle/

# 3. 마이그레이션 적용
bun run db:migrate
```

#### 4. 시드 데이터 추가 (선택사항)

```bash
bun run db:seed
```

---

### 원격 서버 마이그레이션

#### 방법 1: 로컬에서 원격 DB로 Push

```bash
# .env 파일에 원격 DB 정보 설정
DB_HOST=43.200.230.4
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres

# 마이그레이션 실행
bun run db:push
```

#### 방법 2: SSH로 서버 접속 후 실행

```bash
# 1. SSH 접속
ssh your-server

# 2. 프로젝트 디렉토리로 이동
cd /path/to/send-grid-test/elysia-server

# 3. 마이그레이션 실행
bun run db:push
```

#### 방법 3: Docker 컨테이너에서 실행

```bash
# Docker 컨테이너에 접속
docker exec -it send-grid-test-elysia-server-1 sh

# 마이그레이션 실행
bun run db:push

# 또는 외부에서 직접 실행
docker exec send-grid-test-elysia-server-1 bun run db:push
```

---

## Drizzle Kit 명령어

### 1. db:generate
스키마 변경 사항을 감지하고 SQL 마이그레이션 파일 생성

```bash
bun run db:generate
```

**실행 결과:**
- `./drizzle/` 폴더에 새로운 SQL 파일 생성
- 파일명 예시: `0001_ambitious_thor.sql`

---

### 2. db:migrate
생성된 마이그레이션을 데이터베이스에 적용

```bash
bun run db:migrate
```

**실행 과정:**
1. `__drizzle_migrations` 테이블에서 적용된 마이그레이션 확인
2. 미적용된 마이그레이션만 순차 실행
3. 적용 완료 후 히스토리에 기록

---

### 3. db:push
스키마를 직접 데이터베이스에 동기화 (마이그레이션 파일 생성 없음)

```bash
bun run db:push
```

**특징:**
- 마이그레이션 히스토리가 남지 않음
- 빠른 프로토타이핑에 유용
- 개발 환경에서 주로 사용

**주의사항:**
- 🚨 **스키마 변경 전 데이터 백업 권장**
- 🚨 **프로덕션에서는 신중하게 사용**

---

### 4. db:studio
데이터베이스 GUI 도구 실행

```bash
bun run db:studio
```

브라우저에서 `https://local.drizzle.studio` 접속

---

### 5. db:seed
초기 데이터 삽입

```bash
bun run db:seed
```

**실행 내용:**
- 기본 부서(departments) 생성
- 관리자 계정 생성
- 테스트 워크스페이스 생성

---

### 6. db:check
마이그레이션 파일 유효성 검사

```bash
bun run db:check
```

---

## 마이그레이션 워크플로우

### 📌 시나리오 1: 새로운 테이블 추가

#### 1단계: 스키마 정의
`src/db/schema/notifications.ts` 파일 생성

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: varchar('message', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

`src/db/schema.ts`에 export 추가

```typescript
export * from './schema/notifications'
```

#### 2단계: 마이그레이션 실행

**개발 환경 (빠른 방법):**
```bash
bun run db:push
```

**프로덕션 준비:**
```bash
# 1. 마이그레이션 파일 생성
bun run db:generate

# 2. 생성된 SQL 확인
cat drizzle/0002_new_notification.sql

# 3. 적용
bun run db:migrate
```

---

### 📌 시나리오 2: 컬럼 추가/수정

#### 1단계: 스키마 수정
`src/db/schema/users.ts`

```typescript
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  // ✨ 새로운 컬럼 추가
  phoneNumber: varchar('phone_number', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

#### 2단계: 마이그레이션 실행
```bash
bun run db:push
```

---

### 📌 시나리오 3: 복잡한 마이그레이션 (수동 SQL)

#### 1단계: 수동 마이그레이션 파일 작성
`src/db/manual-migrations/002_update_lead_priority.sql`

```sql
-- 새 컬럼 추가
ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- 기존 데이터 업데이트
UPDATE leads
SET priority = CASE
  WHEN lead_status = 'hot' THEN 3
  WHEN lead_status = 'warm' THEN 2
  ELSE 1
END
WHERE priority = 0;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS leads_priority_idx ON leads(priority);

-- 통계 정보 업데이트
ANALYZE leads;
```

#### 2단계: 스키마에 반영
`src/db/schema/leads.ts`

```typescript
export const leads = pgTable('leads', {
  // ... 기존 필드
  priority: integer('priority').default(0).notNull(),
  // ... 나머지 필드
})
```

#### 3단계: 마이그레이션 실행
```bash
bun run db:push
```

수동 SQL 파일은 `migrate.ts`를 통해 실행되지만, 현재는 자동 실행이 비활성화되어 있으므로 직접 실행:

```bash
# PostgreSQL에 직접 연결하여 실행
psql -h localhost -U postgres -d postgres -f src/db/manual-migrations/002_update_lead_priority.sql
```

---

## 프로덕션 배포

### 배포 전 체크리스트

```bash
# 1. 스키마 변경사항 확인
git diff src/db/schema/

# 2. 마이그레이션 파일 생성 (선택사항)
bun run db:generate

# 3. 로컬에서 테스트
bun run db:push

# 4. Git 커밋
git add .
git commit -m "feat: add notifications table"
git push
```

### Docker 배포 워크플로우

#### 1. 이미지 빌드
```bash
docker build -t elysia-server:latest .
```

#### 2. 컨테이너 시작 (마이그레이션 자동 실행 안 됨)
```bash
docker-compose up -d elysia-server
```

#### 3. 수동으로 마이그레이션 실행
```bash
# 방법 A: 컨테이너 내부에서 실행
docker exec -it send-grid-test-elysia-server-1 bun run db:push

# 방법 B: 로컬에서 원격 DB로 실행
bun run db:push
```

#### 4. 애플리케이션 재시작 (필요시)
```bash
docker-compose restart elysia-server
```

---

### GitHub Actions를 통한 자동 배포

#### .github/workflows/deploy.yml

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run Database Migration
        run: bun run db:push
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_PORT: ${{ secrets.DB_PORT }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
          DB_NAME: ${{ secrets.DB_NAME }}

      - name: Build Docker Image
        run: docker build -t elysia-server:${{ github.sha }} .

      - name: Deploy to Server
        run: |
          # SSH로 서버 접속 후 컨테이너 재시작
          ssh ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} << 'EOF'
            cd /path/to/project
            docker-compose pull
            docker-compose up -d
          EOF
```

---

## 트러블슈팅

### ❌ 문제: "ECONNREFUSED ::1:5432"

**원인:** 데이터베이스 연결 실패

**해결:**
```bash
# 1. PostgreSQL 실행 확인
docker ps | grep postgres

# 2. 환경 변수 확인
cat .env | grep DB_

# 3. 올바른 환경 변수 설정
DB_HOST=43.200.230.4  # localhost가 아닌 실제 IP
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres

# 4. 다시 시도
bun run db:push
```

---

### ❌ 문제: "Migration failed: column already exists"

**원인:** 마이그레이션 히스토리 불일치

**해결 방법 1: 히스토리 확인**
```sql
-- 데이터베이스에 직접 연결
psql -h localhost -U postgres -d postgres

-- 마이그레이션 히스토리 확인
SELECT * FROM __drizzle_migrations ORDER BY created_at DESC;
```

**해결 방법 2: 스키마 동기화 (개발 환경)**
```bash
# 현재 DB 상태와 스키마 동기화
bun run db:push
```

---

### ❌ 문제: "No such file or directory: drizzle/"

**원인:** 마이그레이션 파일 폴더 없음

**해결:**
```bash
# 1. 마이그레이션 생성
bun run db:generate

# 2. 폴더 생성 확인
ls -la drizzle/

# 3. 적용
bun run db:migrate
```

---

### ❌ 문제: Docker 컨테이너에서 마이그레이션 실패

**원인:** 환경 변수 또는 네트워크 문제

**해결:**
```bash
# 1. 컨테이너 로그 확인
docker logs send-grid-test-elysia-server-1

# 2. 컨테이너 내부 환경 변수 확인
docker exec send-grid-test-elysia-server-1 env | grep DB_

# 3. 직접 연결 테스트
docker exec send-grid-test-elysia-server-1 psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# 4. 마이그레이션 수동 실행
docker exec send-grid-test-elysia-server-1 bun run db:push
```

---

### ❌ 문제: "You are about to execute current statements" 프롬프트 대기

**원인:** `db:push` 실행 시 확인 프롬프트

**해결:**
```bash
# yes 명령어로 자동 확인
yes y | bun run db:push

# 또는
printf "y\n" | bun run db:push
```

---

## 설정 파일

### drizzle.config.ts

```typescript
import dotenv from 'dotenv'
import type { Config } from 'drizzle-kit'

dotenv.config()

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'postgres',
    ssl: false,
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
  verbose: true,
  strict: true,
} satisfies Config
```

---

### package.json 스크립트

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun src/db/seed.ts",
    "db:check": "drizzle-kit check"
  }
}
```

---

## 베스트 프랙티스

### ✅ DO
- 스키마 변경 전 데이터 백업
- 개발 환경에서 먼저 테스트 후 프로덕션 적용
- 복잡한 마이그레이션은 수동 SQL 파일 작성 (`src/db/manual-migrations/`)
- 마이그레이션 파일은 Git에 커밋
- 프로덕션 배포 전 `db:check` 실행

### ❌ DON'T
- 프로덕션에서 백업 없이 마이그레이션 실행 금지
- 이미 적용된 마이그레이션 파일 수정 금지
- 마이그레이션 파일 수동 삭제 금지
- `db:push` 사용 시 데이터 손실 가능성 주의

---

## 디렉토리 구조

```
elysia-server/
├── src/
│   ├── db/
│   │   ├── schema/                 # 테이블 스키마 (TypeScript)
│   │   │   ├── users.ts
│   │   │   ├── leads.ts
│   │   │   └── ...
│   │   ├── schema.ts               # 통합 export
│   │   ├── migrate.ts              # 마이그레이션 실행 스크립트 (현재 비활성화)
│   │   ├── seed.ts                 # 시드 데이터
│   │   └── manual-migrations/      # 수동 SQL 마이그레이션
│   │       └── 001_create_workflow_emails.sql
├── drizzle/                        # 생성된 SQL 마이그레이션 파일
│   ├── 0000_initial.sql
│   └── meta/
├── drizzle.config.ts               # Drizzle Kit 설정
└── package.json
```

---

## 참고 자료

- [Drizzle ORM 공식 문서](https://orm.drizzle.team)
- [Drizzle Kit 가이드](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL 마이그레이션 가이드](https://orm.drizzle.team/docs/migrations)
- [Drizzle Push vs Generate](https://orm.drizzle.team/kit-docs/commands#prototype--push)
