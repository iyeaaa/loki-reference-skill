# 도메인 엔티티별 구현 패턴 비교 분석

## 요약

elysia-server의 routes와 services 레이어를 분석한 결과, **전반적으로 일관된 패턴**을 유지하고 있으며, 엔티티별로 필요한 비즈니스 로직에 따라 적절한 차이를 보입니다.

**일관성 수준**: ⭐⭐⭐⭐ (4/5)

---

## 1. 공통 패턴

### 1.1 Routes 레이어 패턴

모든 도메인 엔티티는 다음과 같은 **일관된 REST API 구조**를 따릅니다:

```typescript
// 기본 CRUD 엔드포인트
GET    /api/v1/{entity}/search       // 필터링 검색
GET    /api/v1/{entity}/:id          // ID로 조회
POST   /api/v1/{entity}              // 생성
PUT    /api/v1/{entity}/:id          // 업데이트
DELETE /api/v1/{entity}/:id          // 삭제
GET    /api/v1/{entity}              // 페이지네이션 목록

// Admin 벌크 작업
PUT    /api/v1/admin/{entity}/bulk/status    // 상태 일괄 업데이트
DELETE /api/v1/admin/{entity}/bulk           // 일괄 삭제 (일부)
```

#### 공통 요소:
- **스키마 검증**: Elysia의 `t.Object()`를 사용한 타입 안전성
- **에러 핸들링**: 404 응답에 대한 일관된 `errorResponse()` 사용
- **페이지네이션**: `limit`, `offset` 쿼리 파라미터 (기본값 10, 0)
- **필터 파싱**: 배열 필터는 콤마로 구분된 문자열을 split하여 처리

### 1.2 Services 레이어 패턴

모든 서비스는 다음과 같은 **일관된 함수 네이밍**을 따릅니다:

```typescript
// CRUD 작업
get{Entity}(id: string)
create{Entity}(data: CreateData)
update{Entity}(id: string, data: UpdateData)
delete{Entity}(id: string)

// 조회 작업
list{Entities}(limit: number, offset: number)
list{Entities}WithFilters(limit: number, offset: number, filters?: Filters)

// 통계 작업
count{Entities}()
count{Entities}WithFilters(filters?: Filters)

// 벌크 작업
bulkUpdateStatus(ids: string[], status: Status)
bulkDelete(ids: string[])  // 일부
```

#### 공통 요소:
- **Drizzle ORM 사용**: 타입 안전한 쿼리 빌더
- **동적 필터링**: `and()`, `or()`, `ilike()` 조합
- **JOIN 패턴**: 관련 엔티티 정보 포함 (users, workspaces)
- **타임스탬프 자동 관리**: `updatedAt: new Date()`

---

## 2. 엔티티별 차이점

### 2.1 복잡도 비교

| 엔티티 | 복잡도 | Routes 수 | 특수 엔드포인트 | 비고 |
|--------|--------|-----------|-----------------|------|
| **sequences** | ⭐⭐⭐⭐⭐ | 17 | 스텝 관리 (4개), 등록 관리 (3개), 벌크 작업 (4개) | 가장 복잡한 엔티티 |
| **workspaces** | ⭐⭐⭐⭐ | 14 | 멤버 관리 (5개), 소유권 이전 (1개) | 다중 레벨 멤버십 |
| **email-accounts** | ⭐⭐⭐⭐ | 14 | 카운트 관리 (4개), 상태 관리 (3개) | 이메일 발송 추적 |
| **customer-groups** | ⭐⭐⭐ | 11 | 멤버 관리 (4개), 벌크 멤버 작업 (2개) | 그룹-리드 관계 |
| **leads** | ⭐⭐ | 9 | 상태별 조회 (1개), 벌크 작업 (3개) | 비교적 단순 |
| **users** | ⭐⭐⭐ | 11 | 인증 관련 (4개), 벌크 작업 (3개) | 인증/권한 관리 |

### 2.2 필터링 복잡도

#### 가장 복잡한 필터 (email-accounts)
```typescript
filters: {
  status?: 'active' | 'inactive' | 'error' | 'rate_limited' | 'suspended'
  isVerified?: boolean
  isDefault?: boolean
  search?: string            // emailAddress, displayName
  userIds?: string[]
  workspaceIds?: string[]
}
```

#### 중간 복잡도 (leads)
```typescript
filters: {
  leadStatus?: 'new' | 'contacted' | 'qualified' | ...
  businessType?: string
  country?: string
  city?: string
  search?: string            // companyName, websiteUrl
  workspaceIds?: string[]
  createdByIds?: string[]
}
```

#### 단순한 필터 (customer-groups)
```typescript
filters: {
  isDynamic?: boolean
  search?: string            // name, description
  workspaceIds?: string[]
  createdByIds?: string[]
}
```

### 2.3 관계 엔드포인트 패턴

#### Workspace (가장 복잡한 멤버십 관리)
```typescript
// 소유자 관계
GET  /api/v1/workspaces/owner/:ownerId
GET  /api/v1/workspaces/user/:userId

// 멤버 관리 (5개 엔드포인트)
GET    /api/v1/workspaces/:id/members
POST   /api/v1/workspaces/:id/members
PATCH  /api/v1/workspaces/:id/members/:memberId/role
PATCH  /api/v1/workspaces/:id/members/:memberId/status
DELETE /api/v1/workspaces/:id/members/:memberId
```

#### Email Accounts (상태 및 카운트 관리)
```typescript
// 관계 조회
GET /api/v1/email-accounts/user/:userId
GET /api/v1/email-accounts/workspace/:workspaceId
GET /api/v1/email-accounts/workspace/:workspaceId/active

// 카운트 관리 (4개 엔드포인트)
PATCH /api/v1/email-accounts/:id/sent-count
PATCH /api/v1/email-accounts/:id/reset-daily
PATCH /api/v1/email-accounts/:id/reset-monthly
PATCH /api/v1/email-accounts/:id/set-default

// 상태 관리
PATCH /api/v1/email-accounts/:id/error
PATCH /api/v1/email-accounts/:id/sync
```

#### Sequences (다중 레벨 관계)
```typescript
// 기본 관계
GET /api/v1/sequences/workspace/:workspaceId

// 스텝 관리 (4개 엔드포인트)
GET    /api/v1/sequences/:id/steps
POST   /api/v1/sequences/:id/steps
PUT    /api/v1/sequences/:id/steps/:stepId
DELETE /api/v1/sequences/:id/steps/:stepId

// 등록 관리 (3개 엔드포인트)
GET   /api/v1/sequences/:id/enrollments
POST  /api/v1/sequences/:id/enrollments
PATCH /api/v1/sequences/:id/enrollments/:enrollmentId/status

// 벌크 등록 (2개 엔드포인트)
POST /api/v1/admin/sequences/:id/enrollments/bulk
PUT  /api/v1/admin/sequences/enrollments/bulk/unenroll
```

#### Customer Groups (그룹-멤버 관계)
```typescript
// 기본 관계
GET /api/v1/customer-groups/workspace/:workspaceId

// 멤버 관리 (4개 엔드포인트)
GET    /api/v1/customer-groups/:id/members
POST   /api/v1/customer-groups/:id/members
DELETE /api/v1/customer-groups/:id/members/:leadId
GET    /api/v1/customer-groups/lead/:leadId/groups

// 벌크 멤버 작업 (2개 엔드포인트)
POST   /api/v1/admin/customer-groups/:id/members/bulk
DELETE /api/v1/admin/customer-groups/:id/members/bulk
```

#### Leads (단순한 관계)
```typescript
GET /api/v1/leads/workspace/:workspaceId
GET /api/v1/leads/status/:status
```

#### Users (인증 특화)
```typescript
GET  /api/v1/users/email/:email
GET  /api/v1/users/assignable          // admin users only
GET  /api/v1/users/check/:email        // 계정 존재 확인
POST /api/v1/users/google              // Google OAuth
PATCH /api/v1/users/:id/password
PATCH /api/v1/users/:id/login          // 마지막 로그인 업데이트
```

### 2.4 벌크 작업 지원

| 엔티티 | bulkUpdateStatus | bulkDelete | 기타 벌크 작업 |
|--------|------------------|------------|----------------|
| workspaces | ✅ (isActive) | ❌ | transferOwnership |
| email-accounts | ✅ (status enum) | ❌ | - |
| leads | ✅ (leadStatus) | ✅ | bulkUpdateBusinessType |
| sequences | ✅ (status enum) | ✅ | bulkEnroll, bulkUnenroll |
| customer-groups | ❌ | ✅ | bulkAddMembers, bulkRemoveMembers |
| users | ✅ (isActive) | ❌ | bulkUpdateRole, bulkUpdateDepartment |

---

## 3. JOIN 패턴 분석

### 3.1 일관된 JOIN 패턴

모든 엔티티는 관련 정보를 함께 조회하기 위해 JOIN을 사용합니다:

```typescript
// Workspace + User (Owner)
.innerJoin(users, eq(workspaces.ownerId, users.id))

// Email Account + User + Workspace
.innerJoin(users, eq(userEmailAccounts.userId, users.id))
.innerJoin(workspaces, eq(userEmailAccounts.workspaceId, workspaces.id))

// Lead + Workspace + User (Creator)
.innerJoin(workspaces, eq(leads.workspaceId, workspaces.id))
.leftJoin(users, eq(leads.createdBy, users.id))

// User + Department
.innerJoin(departments, eq(users.departmentId, departments.id))
```

### 3.2 JOIN 타입 사용

- **innerJoin**: 필수 관계 (workspace ↔ user)
- **leftJoin**: 선택적 관계 (lead.createdBy는 null 가능)

---

## 4. 스키마 패턴

### 4.1 Create vs Update 스키마

모든 엔티티는 **create**와 **update** 스키마를 분리하여 정의합니다:

```typescript
// Create 스키마 - 많은 필드가 Optional
const workspaceSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  ownerId: t.String({ format: 'uuid' }),
  isActive: t.Optional(t.Boolean()),  // Optional
})

// Update 스키마 - Optional 필드가 Required로 변경
const updateWorkspaceSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  isActive: t.Boolean(),  // Required
})
```

### 4.2 Enum 타입 패턴

Union Literal 타입을 사용한 일관된 enum 정의:

```typescript
// Status enums
t.Union([
  t.Literal('draft'),
  t.Literal('active'),
  t.Literal('paused'),
  t.Literal('archived'),
])

// Role enums
t.Union([
  t.Literal('owner'),
  t.Literal('admin'),
  t.Literal('member'),
  t.Literal('viewer'),
])
```

---

## 5. 특수 기능별 비교

### 5.1 Email Accounts - 발송 추적 및 제한

**가장 특화된 기능을 제공하는 엔티티**

```typescript
// 카운트 관리
updateSentCount(id)              // daily + monthly +1
resetDailySentCount(id)
resetMonthlySentCount(id)

// 상태 관리
updateLastError(id, errorMessage)  // status를 'error'로 자동 변경
updateLastSync(id)
setAsDefault(id, userId, workspaceId)  // 다른 계정들 자동 false 설정
```

### 5.2 Sequences - 다단계 워크플로우

**가장 복잡한 계층 구조**

```typescript
Sequence
  └─ SequenceStep (다대다)
       └─ SequenceStepExecution
  └─ SequenceEnrollment (리드 등록)
       └─ Lead
       └─ UserEmailAccount
```

### 5.3 Workspaces - 멤버십 관리

**복잡한 권한 및 상태 관리**

```typescript
// 멤버 역할: owner | admin | member | viewer
// 멤버 상태: invited | active | inactive | removed

updateWorkspaceMemberRole(memberId, role)
updateWorkspaceMemberStatus(memberId, status)  // active 시 joinedAt 자동 설정
```

### 5.4 Users - 인증 특화

```typescript
// Google OAuth 지원
createOrUpdateGoogleUser(data)  // onConflictDoUpdate 사용

// 비밀번호 관리
updateUserPassword(id, passwordHash)

// 어카운트 체크
checkAccountExists(email)  // EXISTS 쿼리 사용
```

---

## 6. 일관성 평가

### ✅ 높은 일관성 (5/5)

1. **기본 CRUD 구조**: 모든 엔티티가 동일한 엔드포인트 패턴
2. **스키마 검증**: Elysia의 타입 시스템을 일관되게 활용
3. **에러 핸들링**: 404 응답에 대한 일관된 처리
4. **페이지네이션**: limit/offset 패턴 통일
5. **필터 파싱**: 콤마 구분 문자열 → 배열 변환 패턴

### ⚠️ 중간 일관성 (3/5)

1. **벌크 작업**: 대부분 지원하지만 종류가 다름
2. **관계 엔드포인트**: 엔티티 특성에 따라 다르지만 네이밍은 일관
3. **JOIN 패턴**: innerJoin vs leftJoin 선택 기준이 명확

### ⭕ 낮은 일관성 (예상된 차이)

1. **비즈니스 로직**: 각 엔티티의 도메인 특성 반영
2. **특수 엔드포인트**: 필요에 따라 적절하게 추가
3. **필터 복잡도**: 엔티티 속성에 따라 자연스럽게 다름

---

## 7. 개선 제안

### 7.1 일관성 강화

#### 1) 벌크 삭제 지원 통일
현재 일부 엔티티만 `bulkDelete` 지원. 일관성을 위해 모든 엔티티에 추가 권장.

```typescript
// 추가 필요: workspaces, email-accounts, users
DELETE /api/v1/admin/{entity}/bulk
Body: { ids: string[] }
```

#### 2) 관계 엔드포인트 네이밍 통일
```typescript
// 현재
GET /api/v1/leads/workspace/:workspaceId
GET /api/v1/sequences/workspace/:workspaceId

// 제안: prefix 통일
GET /api/v1/leads/by-workspace/:workspaceId
GET /api/v1/sequences/by-workspace/:workspaceId
```

### 7.2 타입 안전성 강화

#### 1) 필터 타입 정의 공유
```typescript
// 공통 필터 인터페이스
interface BaseFilters {
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
  limit?: string
  offset?: string
}

interface EntityFilters extends BaseFilters {
  // 엔티티별 추가 필터
}
```

#### 2) 응답 타입 일관성
```typescript
// 페이지네이션 응답 타입 통일
interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}
```

### 7.3 문서화 개선

각 엔티티의 특수 기능에 대한 주석 추가:

```typescript
// ====================================
// EMAIL ACCOUNT SENDING LIMITS
// ====================================
// - Daily/Monthly limits are tracked per account
// - Sent counts are incremented via updateSentCount()
// - Reset functions should be called by scheduled jobs
// ====================================
```

---

## 8. 결론

### 전반적 평가: ⭐⭐⭐⭐ (4/5)

**강점:**
- 기본 CRUD 패턴의 높은 일관성
- 타입 안전성을 위한 Elysia + Drizzle 조합
- 에러 핸들링 및 페이지네이션 패턴 통일
- 엔티티별 비즈니스 로직을 적절히 반영

**개선점:**
- 벌크 작업 지원 범위 통일 필요
- 관계 엔드포인트 네이밍 규칙 명확화
- 공통 타입 정의로 중복 코드 감소

### 차이점 정리

**도메인 엔티티별로 차이가 심한가?**

**답변: 아니오. 차이는 예상된 범위 내에 있으며, 오히려 일관성이 높습니다.**

1. **기본 CRUD 구조는 100% 일관**
2. **특수 기능은 각 엔티티의 비즈니스 요구사항에 따라 적절히 다름**
3. **전체 코드베이스가 명확한 패턴을 따르고 있어 이해와 유지보수가 용이**

현재 구조는 **일관성**과 **유연성**의 균형을 잘 맞춘 것으로 평가됩니다.