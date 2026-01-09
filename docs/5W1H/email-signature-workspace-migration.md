# Email Signature 워크스페이스 기반 마이그레이션 분석

## 개요

이메일 서명을 워크스페이스별로 관리하도록 시스템 변경

---

## 5W1H 분석

### What (무엇을)

이메일 서명 시스템을 **유저 기반**에서 **워크스페이스 기반**으로 변경

| 변경 전 | 변경 후 |
|---------|---------|
| 유저당 하나의 기본 서명 | 워크스페이스별로 다른 기본 서명 |
| `unique(user_id)` | `unique(user_id, workspace_id)` |

### Why (왜)

1. **설정 메뉴에서 서명 관리가 안 보임** - Trial 유저 제한 코드 존재
2. **워크스페이스 간 서명 분리 필요** - 다른 워크스페이스에서 다른 서명 사용

### Where (어디서)

**관련 테이블:**

| 테이블 | 역할 | 변경 사항 |
|--------|------|-----------|
| `email_signatures` | 서명 본문 저장 | `workspace_id` NOT NULL + CASCADE |
| `user_signature_preferences` | 유저별 기본 서명 설정 | `workspace_id` 컬럼 추가, unique 변경 |

**관련 파일:**

| 위치 | 파일 |
|------|------|
| DB 스키마 | `elysia-server/src/db/schema/email-signatures.ts` |
| DB 스키마 | `elysia-server/src/db/schema/user-signature-preferences.ts` |
| 백엔드 라우트 | `elysia-server/src/routes/email-signatures.routes.ts` |
| 백엔드 서비스 | `elysia-server/src/services/email.service.ts` |
| 프론트엔드 API | `admin/src/lib/api/services/email-signatures.ts` |
| 프론트엔드 훅 | `admin/src/lib/api/hooks/email-signatures.ts` |
| 프론트엔드 UI | `admin/src/pages/settings/EmailSignatureManagement.tsx` |
| 설정 메뉴 | `admin/src/pages/settings.tsx` |

### When (언제)

- **분석일**: 2025-01-09
- **배포 후**: `bun db:migrate` 실행 필요

### Who (누가)

- 시스템 관리자가 마이그레이션 실행
- 모든 사용자에게 영향 (서명 관리 UI 변경)

### How (어떻게)

---

## 실데이터 현황 (2025-01-09)

### email_signatures 테이블

```
total | with_workspace | without_workspace
------+----------------+-------------------
   89 |             89 |                 0
```

- 89개 모두 `workspace_id` 있음 ✅
- 고아 서명 1개 (김태진) 삭제됨

### user_signature_preferences 테이블

**현재 구조:**
```
column_name  | is_nullable
-------------+-------------
id           | NO
user_id      | NO
signature_id | NO
created_at   | NO
updated_at   | NO
```

- `workspace_id` 컬럼 **없음** ❌
- 1개 row 존재

**현재 데이터:**
```
user_id: 0a43b89c-f3c0-4043-bc77-ad8ff1e4135c
signature_id: 5cbfc3ca-ddb6-4181-a535-13459a37b4b9
```

---

## 스키마 변경 사항

### email-signatures.ts

```typescript
// 변경 전
workspaceId: uuid("workspace_id")
  .references(() => workspaces.id)  // nullable

// 변경 후
workspaceId: uuid("workspace_id")
  .notNull()  // NOT NULL
  .references(() => workspaces.id, { onDelete: "cascade" })  // CASCADE
```

### user-signature-preferences.ts

```typescript
// 추가
workspaceId: uuid("workspace_id")
  .notNull()
  .references(() => workspaces.id, { onDelete: "cascade" }),

// unique 제약조건 변경
// 변경 전: uniqueIndex("unique_user_signature").on(table.userId)
// 변경 후:
uniqueUserWorkspace: uniqueIndex("unique_user_workspace_signature").on(
  table.userId,
  table.workspaceId,
),
```

---

## 마이그레이션 파일

**경로:** `drizzle/0044_woozy_gabe_jones.sql`

```sql
-- 1. email_signatures FK 재설정
ALTER TABLE "email_signatures" DROP CONSTRAINT "email_signatures_workspace_id_workspaces_id_fk";
ALTER TABLE "email_signatures" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;

-- 2. 기존 unique index 삭제
DROP INDEX "unique_user_signature";

-- 3. user_signature_preferences에 workspace_id 추가 (nullable)
ALTER TABLE "user_signature_preferences" ADD COLUMN "workspace_id" uuid;

-- 4. 기존 데이터에 workspace_id 할당
UPDATE user_signature_preferences usp
SET workspace_id = es.workspace_id
FROM email_signatures es
WHERE usp.signature_id = es.id AND usp.workspace_id IS NULL;

-- 5. 할당 안된 row 삭제
DELETE FROM user_signature_preferences WHERE workspace_id IS NULL;

-- 6. NOT NULL 적용
ALTER TABLE "user_signature_preferences" ALTER COLUMN "workspace_id" SET NOT NULL;

-- 7. FK 추가
ALTER TABLE "user_signature_preferences" ADD CONSTRAINT "user_signature_preferences_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;

-- 8. 새 unique index 생성
CREATE UNIQUE INDEX "unique_user_workspace_signature"
  ON "user_signature_preferences" USING btree ("user_id","workspace_id");
```

---

## API 변경 사항

### 백엔드 (email-signatures.routes.ts)

| 엔드포인트 | 변경 사항 |
|------------|-----------|
| `GET /` | `workspaceId` 필수 파라미터 |
| `GET /default` | `workspaceId` 필수 파라미터 |
| `POST /` | `workspaceId` 필수 파라미터 |
| `PATCH /:id/set-default` | `workspaceId` 필수 파라미터 |

### 프론트엔드 (email-signatures.ts)

```typescript
// 모든 함수에 workspaceId 필수
list({ workspaceId, includeInactive? })
getDefault(workspaceId)
create(body, workspaceId)
setDefault(id, workspaceId)
```

---

## 해결된 이슈

### email.service.ts - workspaceId 필터 추가 완료 ✅

```typescript
// 수정 완료
async generateUserSignature(
  userId: string,
  workspaceId: string,  // 필수로 변경
) {
  .where(and(
    eq(userSignaturePreferences.userId, userId),
    eq(userSignaturePreferences.workspaceId, workspaceId),  // 추가됨
    eq(emailSignatures.isActive, true)
  ))
}
```

---

## 배포 체크리스트

- [x] Drizzle 스키마 수정 완료
- [x] 백엔드 라우트 수정 완료
- [x] 프론트엔드 API/훅 수정 완료
- [x] 프론트엔드 UI 수정 완료
- [x] Trial 유저 제한 제거
- [x] 고아 서명 삭제 (김태진)
- [x] 마이그레이션 SQL 생성 (`bun db:generate`)
- [x] `email.service.ts` workspaceId 필터 추가
- [ ] 배포
- [ ] `bun db:migrate` 실행
