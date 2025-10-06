# 이메일 계정 관리 전략 가이드

## 개요

발송 이메일 계정을 어떻게 관리할지에 대한 아키텍처 설계 문서입니다. 워크스페이스 단위 vs 유저 단위 관리의 장단점을 분석하고, 현재 시스템의 하이브리드 접근 방식을 설명합니다.

**작성일:** 2025년 10월 6일
**현재 스키마:** `user_email_accounts` (userId + workspaceId)

---

## 현재 시스템: 하이브리드 접근

### 스키마 구조

```typescript
user_email_accounts {
  id: uuid,
  userId: uuid,                    // ✅ 유저 소유권
  workspaceId: uuid,               // ✅ 워크스페이스 소속
  emailAddress: varchar(255),
  displayName: varchar(255),
  apiKey: text,                    // SendGrid API Key
  sendgridVerifiedSenderId: varchar(255),

  isVerified: boolean,
  isDefault: boolean,              // 유저의 기본 이메일 계정

  // Rate limiting (계정별)
  dailyLimit: integer,
  monthlyLimit: integer,
  dailySentCount: integer,
  monthlySentCount: integer,

  status: enum,                    // active, inactive, error, rate_limited, suspended

  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 현재 구조의 의미

**이메일 계정은:**
1. **유저가 소유** - 각 멤버가 자신의 SendGrid 계정/API Key 관리
2. **워크스페이스에 소속** - 해당 워크스페이스 작업에만 사용
3. **유저별 관리** - Rate limiting, 상태, 기본 설정 등은 유저 단위

---

## 접근 방식 비교

### 옵션 1: 워크스페이스 단위 관리

```typescript
// 워크스페이스 공용 이메일 계정
workspace_email_accounts {
  id: uuid,
  workspaceId: uuid,               // ✅ 워크스페이스 소유
  emailAddress: varchar(255),
  apiKey: text,
  // userId 없음 - 공용 리소스
}
```

#### 장점

✅ **중앙화된 관리**
- 워크스페이스 관리자가 모든 이메일 계정 통합 관리
- 계정 설정 변경이 전체 팀에 즉시 적용
- 일관된 발송 정책 적용 가능

✅ **간편한 권한 관리**
- 워크스페이스 멤버 권한으로 이메일 발송 제어
- 멤버 추가/제거 시 이메일 계정 재설정 불필요

✅ **비용 효율성**
- 하나의 SendGrid 계정을 팀 전체가 공유
- API Key 관리 포인트 최소화

✅ **간단한 쿼터 관리**
- 워크스페이스 전체의 발송량 한도 설정
- 팀 단위 사용량 추적 용이

#### 단점

❌ **개인화 부족**
- 모든 멤버가 동일한 발신자 이메일 사용
- 개인 브랜딩 불가능

❌ **책임 추적 어려움**
- 누가 어떤 이메일을 보냈는지 추적 복잡
- Activity logs로 보완 필요

❌ **확장성 제한**
- 대규모 팀에서 병목 발생 가능
- SendGrid Rate Limit을 팀 전체가 공유

❌ **보안 리스크**
- API Key 공유로 인한 보안 취약점
- 한 멤버의 실수가 전체 계정에 영향

#### 적합한 경우

- **소규모 팀** (5~10명 이하)
- **단일 브랜드** 이메일 발송
- **중앙화된 관리가 필요한 경우**
- **비용 최소화가 우선**

---

### 옵션 2: 유저 단위 관리

```typescript
// 유저 개인 이메일 계정
user_email_accounts {
  id: uuid,
  userId: uuid,                    // ✅ 유저 소유
  emailAddress: varchar(255),
  apiKey: text,
  // workspaceId 없음 - 유저 리소스
}
```

#### 장점

✅ **개인화된 발송**
- 각 멤버가 자신의 이메일로 발송
- 개인 브랜딩 유지 (john@company.com)
- 답장이 발송자에게 직접 도착

✅ **명확한 책임 추적**
- 누가 어떤 이메일을 보냈는지 명확
- 감사(audit) 로그 단순화

✅ **독립적인 Rate Limit**
- 각 유저가 자신의 SendGrid 한도 사용
- 한 멤버의 과도한 사용이 다른 멤버에게 영향 없음

✅ **보안 격리**
- 각자의 API Key 관리
- 한 계정 손상 시 피해 최소화

✅ **확장성**
- 팀 규모에 관계없이 성능 유지
- 병렬 발송으로 처리량 증가

#### 단점

❌ **관리 복잡성**
- 각 멤버가 SendGrid 계정 개별 설정 필요
- API Key 관리 포인트 증가

❌ **비용 증가**
- 멤버 수만큼 SendGrid 계정 필요
- 각 계정마다 최소 요금 발생 가능

❌ **일관성 부족**
- 멤버마다 다른 이메일 설정 사용 가능
- 브랜드 일관성 유지 어려움

❌ **온보딩 복잡**
- 신규 멤버 추가 시 이메일 계정 설정 필요
- 기술적 장벽 존재

#### 적합한 경우

- **대규모 팀** (10명 이상)
- **영업팀** (개인 이메일로 고객 관계 구축)
- **높은 발송량** (Rate Limit 분산 필요)
- **개인별 추적이 중요한 경우**

---

### 옵션 3: 하이브리드 (현재 시스템) ⭐ 권장

```typescript
user_email_accounts {
  id: uuid,
  userId: uuid,                    // ✅ 유저 소유
  workspaceId: uuid,               // ✅ 워크스페이스 스코프
  emailAddress: varchar(255),
  apiKey: text,
  isDefault: boolean,
}
```

#### 장점

✅ **유연성 최대화**
- 유저가 워크스페이스마다 다른 이메일 사용 가능
- 개인 계정 + 회사 계정 동시 운영

✅ **명확한 소유권과 범위**
- 유저가 소유하지만 워크스페이스에서만 사용
- 멤버 제거 시 해당 워크스페이스의 이메일만 비활성화

✅ **컨텍스트 기반 발송**
- 같은 유저가 워크스페이스 A에서는 john@companyA.com
- 워크스페이스 B에서는 john@companyB.com 사용

✅ **권한 제어 가능**
- 워크스페이스 멤버 권한으로 이메일 사용 제어
- 워크스페이스별 정책 적용

✅ **감사 추적**
- userId로 "누가" 보냈는지 추적
- workspaceId로 "어떤 프로젝트에서" 보냈는지 추적

#### 단점

❌ **복잡성 증가**
- 스키마가 더 복잡
- 쿼리 및 로직이 복잡해짐

❌ **UI/UX 설계 어려움**
- 유저가 워크스페이스별로 이메일 설정 필요
- 설정 화면 복잡도 증가

#### 적합한 경우 (현재 시스템)

- **다중 워크스페이스 지원**
- **B2B SaaS 플랫폼**
- **프리랜서/에이전시** (클라이언트별 이메일 분리)
- **확장 가능성이 중요한 경우**

---

## 실제 사용 시나리오

### 시나리오 1: 멤버 역할별 이메일 사용

```typescript
// 판매팀 멤버
{
  userId: "john-id",
  workspaceId: "workspace-a",
  emailAddress: "john.sales@company.com",
  isDefault: true
}

// 지원팀 멤버
{
  userId: "jane-id",
  workspaceId: "workspace-a",
  emailAddress: "jane.support@company.com",
  isDefault: true
}

// 같은 워크스페이스, 다른 이메일
```

### 시나리오 2: 다중 워크스페이스 운영

```typescript
// John이 회사 A 프로젝트에서 사용
{
  userId: "john-id",
  workspaceId: "company-a-workspace",
  emailAddress: "john@companyA.com",
  isDefault: true
}

// 동일한 John이 회사 B 프로젝트에서 사용
{
  userId: "john-id",
  workspaceId: "company-b-workspace",
  emailAddress: "john@companyB.com",
  isDefault: true
}
```

### 시나리오 3: 공용 + 개인 이메일 혼용

```typescript
// 워크스페이스 공용 이메일
{
  userId: "admin-id",              // 관리자가 생성
  workspaceId: "workspace-a",
  emailAddress: "team@company.com",
  isDefault: false
}

// John의 개인 이메일
{
  userId: "john-id",
  workspaceId: "workspace-a",
  emailAddress: "john@company.com",
  isDefault: true                  // John의 기본 계정
}

// Jane의 개인 이메일
{
  userId: "jane-id",
  workspaceId: "workspace-a",
  emailAddress: "jane@company.com",
  isDefault: true
}

// 유저는 발송 시 자신의 이메일 또는 팀 이메일 선택 가능
```

---

## 권장 구현 전략

### 1. 기본 규칙 설정

```typescript
// 워크스페이스별 이메일 정책
workspace_email_policies {
  workspaceId: uuid,
  allowPersonalEmails: boolean,    // 개인 이메일 허용 여부
  requireVerification: boolean,    // 이메일 인증 필수 여부
  allowedDomains: text[],          // 허용된 도메인 목록
  sharedEmailIds: uuid[],          // 공용 이메일 계정 ID
  defaultEmailStrategy: enum,      // "user_default" | "shared" | "round_robin"
}
```

### 2. 이메일 선택 로직

```typescript
async function selectEmailAccountForSending(
  userId: string,
  workspaceId: string,
  preferredEmailId?: string
): Promise<UserEmailAccount> {

  // 1. 명시적으로 선택된 이메일 사용
  if (preferredEmailId) {
    const account = await db.query.userEmailAccounts.findFirst({
      where: and(
        eq(userEmailAccounts.id, preferredEmailId),
        eq(userEmailAccounts.workspaceId, workspaceId),
        eq(userEmailAccounts.status, "active")
      )
    })

    if (account) return account
  }

  // 2. 유저의 기본 이메일 사용
  const defaultAccount = await db.query.userEmailAccounts.findFirst({
    where: and(
      eq(userEmailAccounts.userId, userId),
      eq(userEmailAccounts.workspaceId, workspaceId),
      eq(userEmailAccounts.isDefault, true),
      eq(userEmailAccounts.status, "active")
    )
  })

  if (defaultAccount) return defaultAccount

  // 3. 워크스페이스 공용 이메일 사용
  const sharedAccount = await db.query.userEmailAccounts.findFirst({
    where: and(
      eq(userEmailAccounts.workspaceId, workspaceId),
      eq(userEmailAccounts.status, "active"),
      // 공용 계정은 특정 플래그나 userId로 구분
    ),
    orderBy: [asc(userEmailAccounts.dailySentCount)] // 부하 분산
  })

  if (sharedAccount) return sharedAccount

  throw new Error("No available email account for sending")
}
```

### 3. 권한 체크

```typescript
async function canUseEmailAccount(
  userId: string,
  emailAccountId: string,
  workspaceId: string
): Promise<boolean> {

  const account = await db.query.userEmailAccounts.findFirst({
    where: eq(userEmailAccounts.id, emailAccountId)
  })

  if (!account) return false

  // 1. 워크스페이스 일치 확인
  if (account.workspaceId !== workspaceId) return false

  // 2. 소유자 확인
  if (account.userId === userId) return true

  // 3. 워크스페이스 멤버 권한 확인
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
      eq(workspaceMembers.status, "active")
    )
  })

  // 4. 공용 이메일은 모든 active 멤버 사용 가능
  if (member && account.userId === null) return true // 공용 계정 표시 로직 필요

  return false
}
```

### 4. Rate Limit 체크

```typescript
async function checkRateLimits(
  emailAccountId: string
): Promise<{ allowed: boolean; reason?: string }> {

  const account = await db.query.userEmailAccounts.findFirst({
    where: eq(userEmailAccounts.id, emailAccountId)
  })

  if (!account) {
    return { allowed: false, reason: "Account not found" }
  }

  if (account.status !== "active") {
    return { allowed: false, reason: `Account status: ${account.status}` }
  }

  // Daily limit 체크
  if (account.dailyLimit && account.dailySentCount >= account.dailyLimit) {
    return { allowed: false, reason: "Daily limit reached" }
  }

  // Monthly limit 체크
  if (account.monthlyLimit && account.monthlySentCount >= account.monthlyLimit) {
    return { allowed: false, reason: "Monthly limit reached" }
  }

  return { allowed: true }
}

// 발송 후 카운터 증가
async function incrementSentCount(emailAccountId: string) {
  const now = new Date()
  const account = await db.query.userEmailAccounts.findFirst({
    where: eq(userEmailAccounts.id, emailAccountId)
  })

  if (!account) return

  // Daily reset 체크
  const needsDailyReset = !account.lastResetDaily ||
    account.lastResetDaily < startOfDay(now)

  // Monthly reset 체크
  const needsMonthlyReset = !account.lastResetMonthly ||
    account.lastResetMonthly < startOfMonth(now)

  await db.update(userEmailAccounts)
    .set({
      dailySentCount: needsDailyReset ? 1 : (account.dailySentCount + 1),
      monthlySentCount: needsMonthlyReset ? 1 : (account.monthlySentCount + 1),
      lastResetDaily: needsDailyReset ? now : account.lastResetDaily,
      lastResetMonthly: needsMonthlyReset ? now : account.lastResetMonthly
    })
    .where(eq(userEmailAccounts.id, emailAccountId))
}
```

---

## 쿼리 예시

### 1. 워크스페이스의 모든 이메일 계정 조회

```typescript
// 현재 워크스페이스에서 사용 가능한 모든 이메일
async function getWorkspaceEmailAccounts(workspaceId: string) {
  return await db.query.userEmailAccounts.findMany({
    where: and(
      eq(userEmailAccounts.workspaceId, workspaceId),
      eq(userEmailAccounts.status, "active")
    ),
    with: {
      user: true  // 소유자 정보 포함
    },
    orderBy: [desc(userEmailAccounts.isDefault)]
  })
}
```

### 2. 유저가 특정 워크스페이스에서 사용할 수 있는 이메일

```typescript
async function getUserEmailAccountsInWorkspace(
  userId: string,
  workspaceId: string
) {
  // 1. 유저 소유 이메일
  const ownedAccounts = await db.query.userEmailAccounts.findMany({
    where: and(
      eq(userEmailAccounts.userId, userId),
      eq(userEmailAccounts.workspaceId, workspaceId),
      eq(userEmailAccounts.status, "active")
    )
  })

  // 2. 워크스페이스 공용 이메일 (userId가 null이거나 특정 플래그)
  const sharedAccounts = await db.query.userEmailAccounts.findMany({
    where: and(
      eq(userEmailAccounts.workspaceId, workspaceId),
      eq(userEmailAccounts.status, "active"),
      // isShared 플래그 추가 권장
    )
  })

  return [...ownedAccounts, ...sharedAccounts]
}
```

### 3. 유저의 모든 워크스페이스별 이메일

```typescript
async function getUserEmailAccountsAllWorkspaces(userId: string) {
  const accounts = await db.query.userEmailAccounts.findMany({
    where: and(
      eq(userEmailAccounts.userId, userId),
      eq(userEmailAccounts.status, "active")
    ),
    with: {
      workspace: true
    }
  })

  // 워크스페이스별 그룹핑
  const grouped = accounts.reduce((acc, account) => {
    const wsId = account.workspaceId
    if (!acc[wsId]) {
      acc[wsId] = {
        workspace: account.workspace,
        accounts: []
      }
    }
    acc[wsId].accounts.push(account)
    return acc
  }, {} as Record<string, { workspace: Workspace; accounts: UserEmailAccount[] }>)

  return grouped
}
```

---

## 스키마 개선 제안

### 1. 공용 이메일 명시적 표시

```typescript
// 현재 스키마에 추가
userEmailAccounts {
  // ... 기존 필드

  isShared: boolean,               // 공용 이메일 여부
  sharedWithRoles: text[],         // 사용 가능한 역할 ["admin", "member"]
  managedBy: uuid,                 // 관리자 userId (공용 이메일인 경우)
}
```

### 2. 이메일 사용 이력 추적

```typescript
email_account_usage_logs {
  id: uuid,
  emailAccountId: uuid,
  userId: uuid,                    // 실제 사용자
  workspaceId: uuid,
  emailId: uuid,                   // 발송된 이메일
  sentAt: timestamp,

  PRIMARY KEY (id),
  INDEX (emailAccountId, sentAt),
  INDEX (userId, sentAt)
}
```

### 3. 워크스페이스 이메일 정책

```typescript
workspace_email_policies {
  id: uuid,
  workspaceId: uuid,

  allowPersonalEmails: boolean,
  requireVerification: boolean,
  allowedDomains: text[],
  maxEmailsPerUser: integer,

  defaultSenderStrategy: enum,     // "user_default" | "shared" | "round_robin"

  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## 최종 권장사항

### 현재 시스템 (하이브리드) 유지 ✅

**이유:**
1. ✅ 가장 유연한 구조
2. ✅ 다양한 사용 사례 지원
3. ✅ 확장 가능성 최대화
4. ✅ 명확한 소유권 + 범위 지정

### 추가 구현 권장사항

**1단계: 기본 기능 구현**
- [x] userId + workspaceId 구조 (현재 완료)
- [ ] 이메일 선택 로직 (`selectEmailAccountForSending`)
- [ ] 권한 체크 (`canUseEmailAccount`)
- [ ] Rate limit 체크 및 카운터

**2단계: 공용 이메일 지원**
- [ ] `isShared` 플래그 추가
- [ ] 공용 이메일 생성/관리 API
- [ ] 워크스페이스 멤버 공용 이메일 사용 권한

**3단계: 고급 기능**
- [ ] 워크스페이스별 이메일 정책
- [ ] Round-robin 부하 분산
- [ ] 사용량 대시보드
- [ ] 자동 failover (계정 오류 시)

**4단계: UI/UX**
- [ ] 이메일 계정 선택 드롭다운
- [ ] 워크스페이스별 이메일 설정 화면
- [ ] 사용량 모니터링 차트
- [ ] 공용 이메일 관리 인터페이스

---

## 비교 요약표

| 기준 | 워크스페이스 단위 | 유저 단위 | 하이브리드 (현재) |
|------|------------------|----------|-----------------|
| **관리 복잡도** | 낮음 | 중간 | 높음 |
| **개인화** | 낮음 | 높음 | 높음 |
| **비용** | 낮음 | 높음 | 중간 |
| **확장성** | 낮음 | 높음 | 높음 |
| **책임 추적** | 어려움 | 쉬움 | 쉬움 |
| **보안 격리** | 낮음 | 높음 | 높음 |
| **유연성** | 낮음 | 중간 | 최고 |
| **온보딩** | 쉬움 | 복잡 | 중간 |

---

## 참고 자료

- 현재 스키마: `elysia-server/src/db/schema/email-accounts.ts`
- 워크스페이스 관리: `elysia-server/src/db/schema/workspaces.ts`
- 유저 관리: `elysia-server/src/db/schema/users.ts`
- 이메일 히스토리: `docs/EMAIL_HISTORY_MANAGEMENT.md`
