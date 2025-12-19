# 온보딩, Trial, Nylas 연동 가이드

이 문서는 사용자 가입부터 이메일 연동까지의 전체 흐름을 단계별로 설명합니다.

## 목차

1. [전체 흐름 개요](#전체-흐름-개요)
2. [Trial 시스템](#trial-시스템)
3. [온보딩 시스템](#온보딩-시스템)
4. [Nylas 이메일 연동](#nylas-이메일-연동)
5. [데이터베이스 스키마](#데이터베이스-스키마)
6. [API 엔드포인트 정리](#api-엔드포인트-정리)

---

## 전체 흐름 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         사용자 여정 전체 흐름                              │
└─────────────────────────────────────────────────────────────────────────┘

1. 회원가입 (Trial 시작)
   ├─ Google OAuth 또는 이메일 등록
   ├─ User 생성 (trialStartDate, trialEndDate = +7일)
   └─ Workspace 생성 (subscriptionTier: trial)

2. 온보딩 설문 (Step 0)
   ├─ 산업군 선택 (beauty, fashion, it_saas 등)
   ├─ 타겟 선택 (B2B, B2C, Both)
   ├─ 국가 선택 (JP, US, SEA 등)
   └─ 경험도 선택 (none, some, experienced)

3. 자동 생성 시작 (BullMQ Worker)
   ├─ Phase 1: 리드 탐색 (BigQuery + Hunter.io)
   ├─ Phase 2: 고객 그룹 생성
   ├─ Phase 3: 이메일 템플릿 생성 (AI)
   ├─ Phase 4: 시퀀스 생성
   ├─ Phase 5: 이메일 프리뷰 생성
   └─ Phase 6: 완료 알림

4. 온보딩 단계 진행
   ├─ Step 1: 회사 정보 확인
   ├─ Step 2: 리드 선택
   ├─ Step 3: 이메일 확인
   └─ Step 4: 이메일 연동 (Nylas)

5. Nylas 이메일 연동
   ├─ Google OAuth 인증
   ├─ Grant 저장
   └─ 이메일 발송 준비 완료

6. 캠페인 실행
   └─ 온보딩 완료
```

---

## Trial 시스템

### 1. Trial 시작 조건

모든 신규 사용자는 가입 즉시 7일간의 무료 Trial을 받습니다.

**시작 지점:**
- Google OAuth 콜백 (`/api/v1/auth/google/callback`)
- Nylas OAuth 콜백 (`/api/v1/auth/nylas/callback`)
- 이메일 등록 (`/api/v1/auth/register-email`)

**코드 위치:** `elysia-server/src/services/user.service.ts` (Line 47-91)

```typescript
// Trial 생성 로직
const trialStartDate = new Date()
const trialEndDate = new Date()
trialEndDate.setDate(trialEndDate.getDate() + 7) // 7일 Trial

const [newUser] = await db.insert(users).values({
  email,
  trialStartDate,
  trialEndDate,
  isTrialActive: true,
})
```

### 2. Trial 기간

| 항목 | 값 |
|------|-----|
| 기본 Trial 기간 | 7일 |
| 시작 시점 | 가입 즉시 |
| 만료 체크 | 로그인 시점 |

### 3. Trial 상태 확인

**코드 위치:** `elysia-server/src/services/user.service.ts` (Line 1122-1153)

```typescript
export async function checkTrialStatus(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
    })
    .from(users)
    .where(eq(users.id, userId))

  const now = new Date()
  const isTrialExpired = user.trialEndDate && now > user.trialEndDate

  return {
    ...user,
    isTrialExpired,
    daysRemaining: Math.max(0, Math.ceil(
      (user.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )),
  }
}
```

### 4. Trial과 Workspace 연결

Workspace 생성 시 자동으로 Trial 구독이 생성됩니다.

**코드 위치:** `elysia-server/src/services/workspace.service.ts` (Line 136-152)

```typescript
async function createTrialSubscription(workspaceId, customerId) {
  const trialPlan = await getDefaultTrialPlan()
  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + (trialPlan.trialDays || 7))

  await db.insert(subscriptions).values({
    workspaceId,
    customerId,
    status: "trialing",
    trialStart: now,
    trialEnd: trialEnd,
  })
}
```

### 5. Trial 상태에 따른 기능 제한

| Tier | 일일 발송 제한 | 월간 발송 제한 | 기능 |
|------|--------------|--------------|------|
| Trial | 60 | 1,000 | 기본 기능만 |
| Basic | 500 | 10,000 | 확장 기능 |
| Pro | 2,000 | 50,000 | 고급 기능 |
| Enterprise | 무제한 | 무제한 | 모든 기능 |

---

## 온보딩 시스템

### 1. 온보딩 단계 구성

온보딩은 총 **5단계**로 구성됩니다:

| Step | 이름 | 설명 | 완료 조건 |
|------|-----|------|----------|
| 0 | 설문 | 산업군, 타겟, 국가, 경험도 입력 | 4개 필드 모두 입력 |
| 1 | 회사 정보 | 회사명, 설명 확인 | 확인 버튼 클릭 |
| 2 | 리드 검색 | 자동 발견된 리드 선택 | 최소 1개 리드 선택 |
| 3 | 이메일 생성 | AI 생성 이메일 확인 | 확인 버튼 클릭 |
| 4 | 이메일 연동 | Nylas로 Gmail 연동 | OAuth 완료 |
| 5 | 완료 | 캠페인 실행 준비 완료 | 자동 전환 |

### 2. 설문 데이터 (Step 0)

**입력 필드:**

```typescript
interface SurveyData {
  industry: string   // beauty, fashion, food, it_saas, manufacturing, etc.
  target: string     // b2b, b2c, both
  country: string    // jp, us, sea, eu, cn, ae
  experience: string // none, some, experienced
  lang?: string      // ko (한국어) 또는 기타
}
```

**산업군 옵션:**
- `beauty` - 뷰티/화장품
- `fashion` - 패션/의류
- `food` - 식품/음료
- `it_saas` - IT/SaaS
- `manufacturing` - 제조업
- `retail` - 소매업
- `healthcare` - 헬스케어
- `education` - 교육
- `other` - 기타

**국가 옵션:**
- `jp` - 일본
- `us` - 미국
- `sea` - 동남아시아
- `eu` - 유럽
- `cn` - 중국
- `ae` - 중동

### 3. 자동 생성 프로세스 (BullMQ Worker)

설문 완료 후 백그라운드에서 자동 생성이 시작됩니다.

**파일 위치:**
- `elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts`
- `elysia-server/src/services/onboarding-worker.service.ts`

**Phase별 진행:**

```
Phase 1: Discovery (0-30%)
├─ BigQuery로 리드 검색 (최대 300개)
├─ Hunter.io로 이메일 주소 수집
├─ Gemini로 이메일 enrichment
└─ 10개씩 배치 처리

Phase 2: Group (30-40%)
├─ Customer Group 생성
└─ 발견된 리드 자동 추가

Phase 3: Templates (40-65%)
├─ AI로 이메일 템플릿 생성
├─ Introduction 이메일 (Day 0)
└─ Follow-up 이메일 (Day 3)

Phase 4: Sequence (65-75%)
├─ Email Sequence 생성
└─ Sequence Steps 설정

Phase 5: Previews (75-95%)
├─ 각 리드별 이메일 생성
├─ 변수 치환 (회사명, 담당자명)
└─ 필요시 언어 번역

Phase 6: Complete (95-100%)
├─ 온보딩 상태 업데이트
├─ 알림 저장
└─ SSE 완료 이벤트 발송
```

### 4. 실시간 진행 상황 (SSE)

프론트엔드에서 실시간으로 진행 상황을 확인할 수 있습니다.

**SSE 엔드포인트:** `GET /api/v1/onboarding/workspace/{workspaceId}/stream`

**이벤트 타입:**
- `connected` - 초기 연결
- `progress` - 진행 중
- `complete` - 완료
- `error` - 에러

**React Hook 사용:**

```typescript
// admin/src/lib/api/hooks/onboarding.ts
const { progress, phase, progressPercent, isComplete } = useOnboardingSSE(workspaceId)
```

### 5. 온보딩 UI 컴포넌트

| 컴포넌트 | 파일 위치 | 설명 |
|---------|----------|------|
| OnboardingStepper | `admin/src/pages/app/components/OnboardingStepper.tsx` | 상단 진행 표시 |
| OnboardingProgress | `admin/src/pages/app/components/OnboardingProgress.tsx` | 실시간 진행률 |
| StepEmailGeneration | `admin/src/pages/app/components/StepEmailGeneration.tsx` | 이메일 생성 확인 |
| StepEmailLink | `admin/src/pages/app/components/StepEmailLink.tsx` | 이메일 연동 |

---

## Nylas 이메일 연동

### 1. 연동 시작 (OAuth Flow)

**흐름:**

```
1. 사용자가 "이메일 연동" 버튼 클릭
   ↓
2. Frontend: getNylasAuthUrl(workspaceId) 호출
   ↓
3. Backend: Google OAuth URL 생성 (Nylas API 사용)
   ↓
4. 사용자를 Google 로그인 페이지로 리다이렉트
   ↓
5. 사용자가 Google에서 권한 승인
   ↓
6. Google이 /app/redirect?code=... 로 리다이렉트
   ↓
7. Frontend: exchangeCodeForGrant(code, workspaceId) 호출
   ↓
8. Backend: Nylas API로 code → grant 교환
   ↓
9. Grant를 user_email_accounts 테이블에 저장
   ↓
10. 연동 완료
```

**코드 위치:** `elysia-server/src/services/nylas.service.ts` (Line 128-153)

```typescript
export function getNylasAuthUrl(loginHint?: string) {
  const authUrl = nylas.auth.urlForOAuth2({
    clientId: NYLAS_CLIENT_ID,
    provider: "google",
    redirectUri: NYLAS_REDIRECT_URI,
    loginHint: loginHint,
    accessType: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
  })
  return { url: authUrl }
}
```

### 2. Grant 저장

OAuth 완료 후 Grant 정보가 DB에 저장됩니다.

**코드 위치:** `elysia-server/src/routes/nylas.routes.ts` (Line 98-327)

```typescript
// Code를 Grant로 교환
const grant = await exchangeCodeForGrant(code)

// Email Account DB에 저장
const emailAccount = await createEmailAccount({
  userId,
  workspaceId,
  emailAddress: grant.email,
  displayName,
  apiKey: grant.grantId,  // Nylas grantId 저장
  isVerified: true,
  isDefault: true,
  status: "active",
  dailyLimit: 60,   // Trial 기본값
  monthlyLimit: 1000,
})
```

### 3. Trial Preview 계정 마이그레이션

온보딩 중에는 `TRIAL_PREVIEW` 임시 계정으로 이메일 Draft를 생성합니다.
실제 연동 시 이 Draft들이 새 계정으로 마이그레이션됩니다.

```typescript
// 기존 Draft 마이그레이션
if (trialPreviewAccountId) {
  await db.update(emails)
    .set({ userEmailAccountId: emailAccount.id })
    .where(eq(emails.userEmailAccountId, trialPreviewAccountId))

  // 임시 계정 삭제
  await deleteEmailAccount(trialPreviewAccountId)
}
```

### 4. 이메일 발송

Nylas를 통해 이메일을 발송합니다.

**코드 위치:** `elysia-server/src/services/email.service.ts` (Line 431-549)

```typescript
// SendGrid vs Nylas 라우팅
if (apiKey && !apiKey.startsWith("SG")) {
  // Nylas로 발송 (grantId가 SG로 시작하지 않음)
  return await this.sendEmailViaNylas(data, apiKey)
} else {
  // SendGrid로 발송
  return await this.sendEmailViaSendGrid(data, apiKey)
}
```

**Nylas 발송:**

```typescript
const message = await nylas.messages.send({
  identifier: grantId,
  requestBody: {
    to: [{ email: toEmail, name: toName }],
    subject: subject,
    body: bodyHtml,
    trackingOptions: {
      opens: true,
      links: true,
      threadReplies: true,
    },
  }
})
```

### 5. Webhook 이벤트 처리

Nylas에서 이메일 이벤트를 Webhook으로 수신합니다.

**Webhook 엔드포인트:** `POST /api/v1/nylas/api/v1/nylas/webhooks`

**이벤트 타입:**

| 이벤트 | 설명 | 처리 |
|--------|-----|------|
| `message.send_success` | 발송 성공 | status → "delivered" |
| `message.send_failed` | 발송 실패 | status → "failed" |
| `message.bounce_detected` | 바운스 | status → "bounced" |
| `message.opened` | 이메일 오픈 | openCount 증가 |
| `message.link_clicked` | 링크 클릭 | clickCount 증가 |
| `thread.replied` | 답장 수신 | 시퀀스 중단 |

**봇 감지:**

Microsoft ATP 등 보안 스캐너의 자동 오픈/클릭을 필터링합니다.

```typescript
// Microsoft ATP IP 패턴
const microsoftATPIpPatterns = [
  /^4\.182\./, // Azure ATP
  /^57\.155\./, // Microsoft ATP
  /^72\.145\./, // Defender
]

// 스캐너 User-Agent 패턴
const scannerPatterns = [
  /Chrome\/130\.0\.0\.0/, // Microsoft ATP
  /python-requests/i,
  /aiohttp/i,
]
```

### 6. 답장 시 시퀀스 자동 중단

리드가 답장하면 해당 리드의 활성 시퀀스가 자동으로 중단됩니다.

```typescript
// thread.replied 이벤트 처리
await db.update(sequenceEnrollments)
  .set({
    status: "stopped",
    stoppedAt: new Date()
  })
  .where(and(
    eq(sequenceEnrollments.leadId, leadId),
    eq(sequenceEnrollments.status, "active")
  ))
```

---

## 데이터베이스 스키마

### 1. Trial/User 관련

**users 테이블:**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),

  -- Trial 필드
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  is_trial_active BOOLEAN DEFAULT FALSE,

  -- 온보딩 필드
  onboarding_step INTEGER DEFAULT 0,
  onboarding_completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_users_trial_active ON users(is_trial_active);
```

**workspaces 테이블:**

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,

  -- Subscription 필드
  subscription_tier VARCHAR(50) DEFAULT 'trial',  -- trial/basic/pro/enterprise
  subscription_status VARCHAR(50) DEFAULT 'trialing',
  subscription_valid_until TIMESTAMP,
  tier_changed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_workspaces_tier ON workspaces(subscription_tier);
CREATE INDEX idx_workspaces_valid_until ON workspaces(subscription_valid_until);
```

### 2. 온보딩 관련

**onboarding_progress 테이블:**

```sql
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY,
  workspace_id UUID UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,

  -- 상태
  status VARCHAR(50) DEFAULT 'not_started',
  -- not_started, survey_completed, company_info, lead_search,
  -- email_generation, email_link, completed

  current_step INTEGER DEFAULT 0,  -- 0-5

  -- 설문 데이터
  survey_data JSONB,  -- {industry, target, country, experience, lang}

  -- 단계별 완료 시간
  company_info_completed_at TIMESTAMP,
  lead_search_completed_at TIMESTAMP,
  email_generation_completed_at TIMESTAMP,
  email_link_completed_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- 선택된 데이터
  selected_lead_ids JSONB,  -- string[]
  customer_group_id UUID,
  generated_sequence_id UUID,

  -- BullMQ Job 추적
  job_id TEXT,
  job_status VARCHAR(50),  -- waiting, active, completed, failed

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_onboarding_workspace ON onboarding_progress(workspace_id);
CREATE INDEX idx_onboarding_status ON onboarding_progress(status);
CREATE INDEX idx_onboarding_job_id ON onboarding_progress(job_id);
```

### 3. Nylas/이메일 관련

**user_email_accounts 테이블:**

```sql
CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id),

  -- 계정 정보
  email_address VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  api_key TEXT,  -- Nylas grantId 또는 SendGrid API Key

  -- 상태
  is_verified BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'active',
  -- active, inactive, error, rate_limited, suspended

  -- 발송 제한
  daily_limit INTEGER DEFAULT 60,
  monthly_limit INTEGER DEFAULT 1000,
  daily_sent_count INTEGER DEFAULT 0,
  monthly_sent_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_email_accounts_user ON user_email_accounts(user_id);
CREATE INDEX idx_email_accounts_workspace ON user_email_accounts(workspace_id);
CREATE INDEX idx_email_accounts_email ON user_email_accounts(email_address);
```

**emails 테이블:**

```sql
CREATE TABLE emails (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  user_email_account_id UUID REFERENCES user_email_accounts(id),
  lead_id UUID REFERENCES leads(id),
  sequence_id UUID REFERENCES sequences(id),

  -- 이메일 내용
  from_email VARCHAR(255),
  to_email VARCHAR(255),
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,

  -- 상태
  status VARCHAR(50) DEFAULT 'draft',
  -- draft, scheduled, queued, sent, delivered, opened, clicked, replied, bounced, failed

  -- 추적
  message_id VARCHAR(500),
  sendgrid_message_id VARCHAR(500),  -- Nylas messageId도 여기 저장
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- 시간
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_emails_workspace ON emails(workspace_id);
CREATE INDEX idx_emails_lead ON emails(lead_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_message_id ON emails(message_id);
```

**email_events 테이블:**

```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES emails(id),

  -- 이벤트 정보
  event_type VARCHAR(50),
  -- processed, delivered, open, click, bounce, dropped, spam_report, unsubscribe

  timestamp TIMESTAMP,
  user_agent TEXT,
  ip_address VARCHAR(50),
  url TEXT,  -- Click 이벤트용

  -- 바운스 정보
  bounce_type VARCHAR(50),
  bounce_reason TEXT,

  -- 봇 감지
  possibly_bot BOOLEAN DEFAULT FALSE,

  -- 원본 데이터
  raw_event_data JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_email_events_email ON email_events(email_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
```

---

## API 엔드포인트 정리

### 1. 인증 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/auth/register-email` | POST | 이메일 등록 (Trial 시작) |
| `/api/v1/auth/google` | GET | Google OAuth URL |
| `/api/v1/auth/google/callback` | POST | Google OAuth 콜백 |
| `/api/v1/auth/nylas` | GET | Nylas OAuth URL (Trial signup) |
| `/api/v1/auth/nylas/callback` | POST | Nylas OAuth 콜백 |

### 2. 온보딩 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/onboarding/workspace/{id}` | GET | 진행 상태 조회 |
| `/api/v1/onboarding/workspace/{id}/survey` | POST | 설문 저장 |
| `/api/v1/onboarding/workspace/{id}/step1/complete` | POST | Step 1 완료 |
| `/api/v1/onboarding/workspace/{id}/step2/complete` | POST | Step 2 완료 |
| `/api/v1/onboarding/workspace/{id}/step3/complete` | POST | Step 3 완료 |
| `/api/v1/onboarding/workspace/{id}/step4/complete` | POST | Step 4 완료 |
| `/api/v1/onboarding/workspace/{id}/complete` | POST | 온보딩 완료 |
| `/api/v1/onboarding/workspace/{id}/step` | PATCH | 단계 업데이트 |
| `/api/v1/onboarding/workspace/{id}/stream` | GET | SSE 스트리밍 |
| `/api/v1/onboarding/workspace/{id}/reset` | POST | 온보딩 리셋 |
| `/api/v1/onboarding/incomplete` | GET | 미완료 목록 |
| `/api/v1/onboarding/stats` | GET | 통계 조회 |

### 3. Nylas API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/nylas/auth` | GET | OAuth URL 생성 |
| `/api/v1/nylas/callback` | GET | OAuth 콜백 |
| `/api/v1/nylas/grant/{grantId}` | GET | Grant 정보 조회 |
| `/api/v1/nylas/grant/{accountId}` | DELETE | Grant 삭제 |
| `/api/v1/nylas/setup-connector` | POST | Google Connector 설정 |
| `/api/v1/nylas/api/v1/nylas/webhooks` | GET | Webhook Challenge |
| `/api/v1/nylas/api/v1/nylas/webhooks` | POST | Webhook 이벤트 |

### 4. 이메일 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/emails/send` | POST | 이메일 발송 |
| `/api/v1/emails/send-nylas-test` | POST | Nylas 테스트 발송 |
| `/api/v1/emails/{id}` | GET | 이메일 조회 |
| `/api/v1/emails/{id}/status` | GET | 상태 조회 |

### 5. Billing API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/billing/products` | GET | 상품 목록 |
| `/api/v1/billing/plans` | GET | 요금제 목록 |
| `/api/v1/billing/subscriptions` | GET | 구독 조회 |
| `/api/v1/billing/subscriptions` | POST | 구독 생성 |

---

## 환경 변수 설정

```bash
# Nylas Email Integration
NYLAS_API_KEY=              # Nylas API Key
NYLAS_API_URI=https://api.us.nylas.com
NYLAS_CLIENT_ID=            # Nylas OAuth Client ID
NYLAS_REDIRECT_URI=http://localhost:5173/app/redirect

# Google OAuth (for Nylas connector)
GCP_CLIENT_ID=              # Google OAuth Client ID
GCP_CLIENT_SECRET=          # Google OAuth Client Secret

# BullMQ/Redis
REDIS_URL=redis://localhost:6379

# BigQuery (for lead discovery)
BIGQUERY_PROJECT_ID=
BIGQUERY_DATASET_ID=

# Hunter.io (for email enrichment)
HUNTER_API_KEY=

# Gemini (for AI generation)
GEMINI_API_KEY=
```

---

## React Query Hooks (Frontend)

### 온보딩 Hooks

```typescript
// 진행 상태 조회
const { data, isLoading } = useOnboardingProgress(workspaceId)

// 설문 저장
const { mutate: saveSurvey } = useSaveSurvey()
saveSurvey({ workspaceId, data: surveyData })

// 단계별 완료
const { mutate: completeStep1 } = useCompleteStep1()
const { mutate: completeStep2 } = useCompleteStep2()
const { mutate: completeStep3 } = useCompleteStep3()
const { mutate: completeStep4 } = useCompleteStep4()

// 온보딩 완료
const { mutate: complete } = useCompleteOnboarding()

// 완료 여부 확인
const { isComplete, currentStep, status } = useIsOnboardingComplete(workspaceId)

// 실시간 SSE
const { progress, phase, progressPercent, isComplete } = useOnboardingSSE(workspaceId)
```

### Nylas Hooks

```typescript
// OAuth URL 가져오기
const { data: authUrl } = useNylasAuthUrl(workspaceId)

// Grant 정보 조회
const { data: grant } = useNylasGrant(grantId)

// Grant 삭제
const { mutate: deleteGrant } = useDeleteNylasGrant()
```

---

## 문제 해결

### 온보딩이 멈춘 경우

1. BullMQ Job 상태 확인:
   ```sql
   SELECT job_id, job_status FROM onboarding_progress
   WHERE workspace_id = 'your-workspace-id';
   ```

2. 온보딩 리셋:
   ```bash
   POST /api/v1/onboarding/workspace/{id}/reset
   ```

### Nylas 연동 실패

1. Grant 유효성 확인:
   ```bash
   GET /api/v1/nylas/grant/{grantId}
   ```

2. 재연동:
   - 기존 Grant 삭제 후 다시 OAuth 진행

### Trial 만료 후

1. Trial 상태 확인:
   ```bash
   GET /api/v1/auth/trial-status
   ```

2. 구독 업그레이드:
   ```bash
   POST /api/v1/billing/subscriptions
   ```

---

## 관련 문서

- [ONBOARDING.md](./ONBOARDING.md) - 온보딩 기본 문서
- [ONBOARDING_ARCHITECTURE.md](./ONBOARDING_ARCHITECTURE.md) - 온보딩 아키텍처
- [BULLMQ_ARCHITECTURE_GUIDE.md](./BULLMQ_ARCHITECTURE_GUIDE.md) - BullMQ 가이드
- [iam-access-control-analysis.md](./iam-access-control-analysis.md) - 권한 관리
