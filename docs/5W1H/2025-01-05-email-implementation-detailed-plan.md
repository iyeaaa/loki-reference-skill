# 온보딩 이메일 상세 구현 계획

> 작성일: 2025-01-05
> 기준: 현재 코드베이스 완전 분석
> 버전: 1.0

---

## 현재 코드베이스 분석

### 핵심 파일 구조

```
elysia-server/src/
├── config.ts                                    # 환경설정 (loops 설정 포함)
├── db/schema/
│   ├── workspaces.ts                           # 워크스페이스 (subscriptionTier, subscriptionValidUntil)
│   ├── billing.ts                              # 구독 (trialEnd, status)
│   ├── onboarding.ts                           # 온보딩 진행 (surveyData, currentStep)
│   ├── leads.ts                                # 리드 (companyName)
│   ├── sequences.ts                            # 시퀀스 (status: active/paused)
│   └── email-accounts.ts                       # 이메일 계정 (userEmailAccounts)
├── services/
│   ├── loops.service.ts                        # Loops.so 이메일 발송
│   └── onboarding-worker.service.ts            # 온보딩 완료 로직
└── workers/bullmq/
    ├── index.ts                                # 워커 export
    ├── trial-expiration.worker.ts              # 체험판 만료 워커 (패턴 참조)
    └── onboarding-auto-generate.worker.ts      # 온보딩 자동 생성 워커
```

### 현재 DB 스키마 분석

#### 1. workspaces 테이블

```typescript
// 기존 필드
workspaces = {
  id, name, ownerId,
  companyName, industry,                        // 회사 정보
  subscriptionTier,                             // trial/basic/pro/enterprise
  subscriptionStatus,                           // trialing/active/expired
  subscriptionValidUntil,                       // 구독 만료일
}
```

#### 2. onboarding_progress 테이블

```typescript
// 기존 필드
onboardingProgress = {
  workspaceId,
  status,                                       // not_started ~ completed
  currentStep,                                  // 0-5
  surveyData: {                                 // JSON
    industry, target, country, experience, lang
  },
  selectedLeadIds,                              // JSON array
  customerGroupId,
  generatedSequenceId,
  completedAt,                                  // 온보딩 완료 시간 ✅ 이미 존재
  jobId, jobStatus,
}
```

#### 3. subscriptions 테이블

```typescript
// 기존 필드
subscriptions = {
  workspaceId,
  status,                                       // trialing/active/expired
  trialStart,
  trialEnd,                                     // 체험판 종료일 ✅ 이미 존재
}
```

#### 4. userEmailAccounts 테이블

```typescript
// 이메일 연결 확인용
userEmailAccounts = {
  workspaceId,
  provider,                                     // sendgrid/nylas/unipile
  emailAddress,
  isVerified,
  status,                                       // active/inactive/error
}
```

#### 5. sequences 테이블

```typescript
// 캠페인 상태 확인용
sequences = {
  workspaceId,
  status,                                       // draft/ready/active/paused
}
```

### 현재 loops.service.ts 분석

```typescript
// 현재 인터페이스
interface OnboardingCompleteEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"
}

// 현재 제목줄
const EMAIL_TEXTS = {
  ko: {
    subject: "[Rinda] 당신의 캠페인이 준비되었습니다!",  // ❌ 고정 문자열
    // ...
  },
}

// 현재 HTML 템플릿 구조
// 1. 헤더 (Rinda 로고)
// 2. 성공 배지
// 3. 인사말 + 소개
// 4. 통계 카드
// 5. CTA 버튼
// 6. 다음 단계 (2개)
// 7. 푸터
```

### 현재 config.ts 분석

```typescript
config.loops = {
  apiKey: getEnvOrDefault("LOOPS_API_KEY", ""),
  transactionalIds: {
    onboardingComplete: getEnvOrDefault(
      "LOOPS_TRANSACTIONAL_ONBOARDING_COMPLETE",
      "cmjju1bio06vt0hzt094zh3a4"
    ),
  },
}
```

---

## Email 1: 온보딩 완료 알림 (최적화)

### 변경 사항 요약

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 제목줄 | 고정 문자열 | 동적 생성 (이름 + 숫자) |
| 개인화 | 이름만 | 이름 + 산업 + 기업명 |
| 진행률 | 없음 | 60% 바 표시 |
| 체험판 기간 | 없음 | 잔여 일수 배너 |
| 소셜 프루프 | 없음 | 고객 후기 1개 |
| 다음 단계 | 2개 | 3개 + 예상 시간 |

### Step 1.1: 인터페이스 확장

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
// 현재 (라인 30-37)
interface OnboardingCompleteEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"
}

// 변경 후
interface OnboardingCompleteEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"

  // 🆕 추가 필드
  trialDaysRemaining?: number      // 체험판 잔여 일수
  industry?: string                // 산업 (한글/영문)
  topCompanies?: string[]          // 발견된 상위 기업명 (최대 3개)
}
```

### Step 1.2: EMAIL_TEXTS 수정

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
// 현재 (라인 49-78)
const EMAIL_TEXTS = {
  ko: {
    subject: "[Rinda] 당신의 캠페인이 준비되었습니다!",
    // ...
  },
}

// 변경 후
const EMAIL_TEXTS = {
  ko: {
    // 🆕 동적 제목줄 함수
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, ${leadCount}명 바이어 발견`,
    subjectFallback: "바이어 리스트가 준비되었습니다",

    title: "온보딩 완료",
    greeting: (name: string) => `안녕하세요 ${name}님,`,

    // 🆕 산업별 맞춤 인트로
    intro: (industry?: string) =>
      industry
        ? `${industry} 업계 바이어 리스트와 이메일 초안이 준비되었습니다.`
        : "린다(Rinda) AI가 바이어 리스트와 이메일 초안을 준비했습니다.",

    leadsFound: "발견된 리드",
    emailsGenerated: "생성된 이메일",
    ctaButton: "대시보드에서 확인하기 →",

    // 🆕 진행률
    progressTitle: "온보딩 진행률",
    progressStatus: "3/5 완료 - 이메일 연결만 남았어요!",

    // 🆕 체험판
    trialRemaining: (days: number) => `체험판 종료까지 ${days}일 남았습니다`,

    // 🆕 발견 기업
    topCompaniesTitle: "발견된 주요 기업",
    topCompaniesMore: (count: number) => `외 ${count}개`,

    // 🆕 소셜 프루프
    testimonial: {
      quote: "Rinda로 첫 달에 42개 미팅을 잡았습니다. B2B 영업이 이렇게 쉬울 줄 몰랐어요.",
      author: "김OO",
      company: "ABC 무역 대표",
    },

    nextStepsTitle: "다음 단계",
    // 🆕 예상 시간 포함
    nextSteps: [
      { text: "이메일 계정 연결하기", time: "2분" },
      { text: "첫 번째 이메일 초안 검토하기", time: null },
      { text: "캠페인 시작하기!", time: null },
    ],

    footer: "이 이메일은 린다 AI 온보딩 완료 알림입니다.",
    footerContact: "문의사항이 있으시면 admin@grinda.ai로 연락해주세요.",
    defaultName: "고객",
  },

  en: {
    subject: (firstName: string, leadCount: number) =>
      `${firstName}, ${leadCount} buyers found`,
    subjectFallback: "Your buyer list is ready",
    title: "Onboarding Complete",
    greeting: (name: string) => `Hi ${name},`,
    intro: (industry?: string) =>
      industry
        ? `Your ${industry} buyer list and email drafts are ready.`
        : "Rinda AI has prepared your buyer list and email drafts.",
    leadsFound: "Leads Found",
    emailsGenerated: "Emails Generated",
    ctaButton: "View Dashboard →",
    progressTitle: "Onboarding Progress",
    progressStatus: "3/5 complete - just connect your email!",
    trialRemaining: (days: number) => `${days} days left in your trial`,
    topCompaniesTitle: "Top Companies Found",
    topCompaniesMore: (count: number) => `and ${count} more`,
    testimonial: {
      quote: "We booked 42 meetings in the first month with Rinda.",
      author: "John D.",
      company: "CEO, ABC Trading",
    },
    nextStepsTitle: "NEXT STEPS",
    nextSteps: [
      { text: "Connect your email account", time: "2 min" },
      { text: "Review your first email draft", time: null },
      { text: "Start your campaign!", time: null },
    ],
    footer: "This email is a Rinda AI onboarding notification.",
    footerContact: "For inquiries, contact admin@grinda.ai",
    defaultName: "there",
  },
} as const
```

### Step 1.3: sendOnboardingCompleteEmail 수정

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
// 현재 (라인 309-332)
export async function sendOnboardingCompleteEmail(
  data: OnboardingCompleteEmailData,
): Promise<boolean> {
  const language = data.language || "ko"
  const t = EMAIL_TEXTS[language]

  try {
    const content = createOnboardingCompleteEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: "Rinda",
      to: data.email,
      subject: t.subject,  // ❌ 고정 문자열
      body: JSON.stringify({ content }),
    })

    return response.success
  } catch (error) {
    return false
  }
}

// 변경 후
export async function sendOnboardingCompleteEmail(
  data: OnboardingCompleteEmailData,
): Promise<boolean> {
  const language = data.language || "ko"
  const t = EMAIL_TEXTS[language]
  const name = data.firstName || t.defaultName

  // 🆕 동적 제목줄 생성
  const subject = typeof t.subject === "function"
    ? t.subject(name, data.leadCount)
    : t.subjectFallback

  logger.info(`[Loops] Preparing email for ${data.email}, subject: ${subject}`)

  try {
    const content = createOnboardingCompleteEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: "Rinda",
      to: data.email,
      subject,  // 🆕 동적 제목줄
      body: JSON.stringify({ content }),
    })

    return response.success
  } catch (error) {
    logger.error(`[Loops] Failed: ${error}`)
    return false
  }
}
```

### Step 1.4: onboarding-worker.service.ts 수정

**파일:** `elysia-server/src/services/onboarding-worker.service.ts`

```typescript
// 현재 (라인 1139-1161)
if (isLoopsConfigured()) {
  try {
    const user = await getUser(userId)
    if (user?.email) {
      const emailCount = leadIds.length * 3

      await sendOnboardingCompleteEmail({
        email: user.email,
        firstName: user.username || undefined,
        leadCount: leadIds.length,
        emailCount,
        dashboardUrl: `${config.frontendUrl}/company?step=4`,
        language: surveyData.lang === "en" ? "en" : "ko",
      })
    }
  } catch (emailError) {
    console.error("[CompletePhase] Failed to send completion email:", emailError)
  }
}

// 변경 후
if (isLoopsConfigured()) {
  try {
    const user = await getUser(userId)
    if (user?.email) {
      const emailCount = leadIds.length * 3
      const lang = surveyData.lang === "en" ? "en" : "ko"

      // 🆕 1. 체험판 잔여 기간 계산
      const subscription = await db
        .select({ trialEnd: subscriptions.trialEnd })
        .from(subscriptions)
        .where(eq(subscriptions.workspaceId, workspaceId))
        .limit(1)

      const trialDaysRemaining = subscription[0]?.trialEnd
        ? Math.max(0, Math.ceil(
            (new Date(subscription[0].trialEnd).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
          ))
        : undefined

      // 🆕 2. 상위 기업 3개 추출
      const topLeads = await db
        .select({ companyName: leads.companyName })
        .from(leads)
        .where(inArray(leads.id, leadIds.slice(0, 10)))
        .limit(3)

      const topCompanies = topLeads
        .map(l => l.companyName)
        .filter((name): name is string => !!name)

      // 🆕 3. 산업 라벨 매핑
      const industryLabels: Record<string, { ko: string; en: string }> = {
        beauty: { ko: "뷰티/화장품", en: "Beauty" },
        fashion: { ko: "패션/의류", en: "Fashion" },
        food: { ko: "식품", en: "Food" },
        it_saas: { ko: "IT/SaaS", en: "IT/SaaS" },
        manufacturing: { ko: "제조", en: "Manufacturing" },
        living: { ko: "리빙/홈데코", en: "Living" },
      }

      const industry = surveyData.industry
        ? industryLabels[surveyData.industry]?.[lang]
        : undefined

      // 🆕 4. 확장된 데이터로 이메일 발송
      await sendOnboardingCompleteEmail({
        email: user.email,
        firstName: user.username || undefined,
        leadCount: leadIds.length,
        emailCount,
        dashboardUrl: `${config.frontendUrl}/company?step=4`,
        language: lang,
        trialDaysRemaining,
        industry,
        topCompanies,
      })

      console.log(`[CompletePhase] Sent email to ${user.email}`)
    }
  } catch (emailError) {
    console.error("[CompletePhase] Failed:", emailError)
  }
}
```

### Step 1.5: HTML 템플릿 업데이트

**파일:** `elysia-server/src/services/loops.service.ts`

`createOnboardingCompleteEmailHTML` 함수를 완전히 교체 (이전 문서 참조)

주요 추가 섹션:
1. 진행률 바 (60%)
2. 체험판 잔여 기간 배너
3. 산업별 맞춤 인트로
4. 상위 기업 표시
5. 소셜 프루프
6. 다음 단계 + 예상 시간

---

## Email 2: 재참여 이메일 (신규 구현)

### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    BullMQ Queue                              │
│                  "reengagement-email"                        │
├─────────────────────────────────────────────────────────────┤
│ Schedule: 매일 오전 10시 (KST)                               │
│ Cron: "0 1 * * *" (UTC)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │             reengagement-email.worker.ts            │    │
│  │                                                      │    │
│  │  1. 비활성 사용자 조회                                │    │
│  │     - onboarding_progress.completedAt < 24시간 전    │    │
│  │     - userEmailAccounts 없음 (이메일 미연결)          │    │
│  │     - sequences.status !== 'active' (캠페인 미시작)   │    │
│  │     - reengagement_email_sent_at IS NULL              │    │
│  │                                                      │    │
│  │  2. 각 사용자에게 이메일 발송                          │    │
│  │     - sendReengagementEmail() 호출                    │    │
│  │                                                      │    │
│  │  3. 발송 기록 저장                                     │    │
│  │     - onboarding_progress.reengagement_email_sent_at  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 2.1: DB 스키마 수정

**파일:** `elysia-server/src/db/schema/onboarding.ts`

```typescript
// 현재 (라인 27-87)
export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    // ... 기존 필드들

    // 온보딩 완료 시간 (이미 존재)
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // 🆕 추가: 재참여 이메일 발송 기록
    reengagementEmailSentAt: timestamp("reengagement_email_sent_at", {
      withTimezone: true,
    }),

    // 메타데이터
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // 기존 인덱스들...

    // 🆕 추가: 재참여 이메일 조회용 인덱스
    reengagementIdx: index("idx_onboarding_reengagement").on(
      table.completedAt,
      table.reengagementEmailSentAt,
    ),
  }),
)
```

### Step 2.2: DB 마이그레이션 생성

**파일:** `elysia-server/drizzle/XXXX_add_reengagement_email.sql`

```sql
-- 재참여 이메일 발송 기록 필드 추가
ALTER TABLE onboarding_progress
ADD COLUMN reengagement_email_sent_at TIMESTAMP WITH TIME ZONE;

-- 인덱스 추가
CREATE INDEX idx_onboarding_reengagement
ON onboarding_progress (completed_at, reengagement_email_sent_at);

-- 코멘트
COMMENT ON COLUMN onboarding_progress.reengagement_email_sent_at
IS '재참여 이메일 발송 시간 (NULL이면 미발송)';
```

### Step 2.3: loops.service.ts에 재참여 이메일 추가

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
// ====================================
// 🆕 재참여 이메일 타입
// ====================================

interface ReengagementEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"
  trialDaysRemaining?: number
}

// ====================================
// 🆕 재참여 이메일 텍스트
// ====================================

const REENGAGEMENT_TEXTS = {
  ko: {
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, ${leadCount}명 바이어가 기다리고 있어요`,
    subjectFallback: "바이어들이 기다리고 있어요",

    greeting: (name: string) => `안녕하세요 ${name}님,`,
    intro: (leadCount: number) =>
      `어제 발견한 ${leadCount}명의 바이어가 아직 연락을 기다리고 있어요.`,

    statusTitle: "현재 상태",
    statusItems: (leadCount: number, emailCount: number) => [
      { text: `리드 발굴 완료 (${leadCount}명)`, done: true },
      { text: `이메일 초안 생성 완료 (${emailCount}개)`, done: true },
      { text: "이메일 계정 연결", done: false, label: "대기중" },
      { text: "캠페인 시작", done: false, label: "대기중" },
    ],

    tipTitle: "2분만 투자하세요",
    tipText: "이메일 계정만 연결하면 바로 캠페인을 시작할 수 있어요.",

    ctaButton: "지금 이메일 연결하기 →",

    trialRemaining: (days: number) => `체험판 종료까지 ${days}일`,

    testimonial: {
      quote: "첫 주에 15개 답장을 받았어요. 기대 이상이었습니다.",
      author: "박OO",
      company: "XYZ 트레이딩 대표",
    },

    footer: "이 이메일은 린다 AI 온보딩 후속 알림입니다.",
    footerContact: "문의사항이 있으시면 admin@grinda.ai로 연락해주세요.",
    defaultName: "고객",
  },

  en: {
    subject: (firstName: string, leadCount: number) =>
      `${firstName}, ${leadCount} buyers are waiting`,
    subjectFallback: "Your buyers are waiting",

    greeting: (name: string) => `Hi ${name},`,
    intro: (leadCount: number) =>
      `The ${leadCount} buyers you discovered yesterday are still waiting.`,

    statusTitle: "Current Status",
    statusItems: (leadCount: number, emailCount: number) => [
      { text: `Lead discovery complete (${leadCount})`, done: true },
      { text: `Email drafts ready (${emailCount})`, done: true },
      { text: "Connect email account", done: false, label: "Pending" },
      { text: "Start campaign", done: false, label: "Pending" },
    ],

    tipTitle: "Just 2 minutes",
    tipText: "Connect your email account and you're ready to launch.",

    ctaButton: "Connect Email Now →",

    trialRemaining: (days: number) => `${days} days left in trial`,

    testimonial: {
      quote: "Got 15 replies in the first week. Better than expected.",
      author: "John P.",
      company: "CEO, XYZ Trading",
    },

    footer: "This is a follow-up from Rinda AI.",
    footerContact: "For inquiries, contact admin@grinda.ai",
    defaultName: "there",
  },
} as const

// ====================================
// 🆕 재참여 이메일 HTML 생성
// ====================================

function createReengagementEmailHTML(data: ReengagementEmailData): string {
  const {
    firstName,
    leadCount,
    emailCount,
    dashboardUrl,
    language = "ko",
    trialDaysRemaining,
  } = data

  const t = REENGAGEMENT_TEXTS[language]
  const name = firstName || t.defaultName
  const statusItems = t.statusItems(leadCount, emailCount)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" width="100%" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 20px 12px;">
        <table role="presentation" width="480" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; padding: 20px 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 800; color: #ffffff;">Rinda</div>
            </td>
          </tr>

          <!-- Trial Warning -->
          ${trialDaysRemaining !== undefined ? `
          <tr>
            <td style="padding: 16px 24px 0;">
              <table role="presentation" width="100%" style="background-color: #FEF3C7; border-radius: 8px;">
                <tr>
                  <td align="center" style="padding: 12px 16px;">
                    <span style="color: #D97706; font-size: 13px; font-weight: 600;">
                      ⏰ ${t.trialRemaining(trialDaysRemaining)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- Greeting -->
          <tr>
            <td style="padding: 20px 24px 12px;">
              <h2 style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0 0 8px;">
                ${t.greeting(name)}
              </h2>
              <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
                ${t.intro(leadCount)}
              </p>
            </td>
          </tr>

          <!-- Status Checklist -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
                <tr>
                  <td style="padding: 16px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase;">
                      ${t.statusTitle}
                    </div>
                    ${statusItems.map(item => `
                    <div style="padding: 6px 0; font-size: 13px; display: flex; align-items: center;">
                      <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; text-align: center; line-height: 20px; margin-right: 10px; font-size: 11px; ${
                        item.done
                          ? "background-color: #22C55E; color: #fff;"
                          : "background-color: #E5E7EB; color: #9CA3AF;"
                      }">
                        ${item.done ? "✓" : "○"}
                      </span>
                      <span style="color: ${item.done ? "#374151" : "#9CA3AF"};">
                        ${item.text}
                        ${item.label ? `<span style="color: #F59E0B; font-size: 11px; margin-left: 4px;">(${item.label})</span>` : ""}
                      </span>
                    </div>
                    `).join("")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tip -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%" style="background-color: #EFF6FF; border-radius: 8px; border-left: 3px solid #3B82F6;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <div style="font-size: 13px; font-weight: 600; color: #1E40AF; margin-bottom: 4px;">
                      💡 ${t.tipTitle}
                    </div>
                    <div style="font-size: 13px; color: #3B82F6;">
                      ${t.tipText}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
                    <a href="${dashboardUrl}" style="display: block; padding: 14px 20px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      ${t.ctaButton}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Testimonial -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%" style="background-color: #F0FDF4; border-radius: 8px; border-left: 3px solid #22C55E;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="font-style: italic; color: #166534; font-size: 13px; margin: 0 0 6px;">
                      "${t.testimonial.quote}"
                    </p>
                    <p style="font-size: 11px; color: #6B7280; margin: 0;">
                      - ${t.testimonial.author}, ${t.testimonial.company}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 12px 24px 16px; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center; line-height: 1.5;">
                ${t.footer}<br/>${t.footerContact}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// ====================================
// 🆕 재참여 이메일 발송 함수
// ====================================

export async function sendReengagementEmail(
  data: ReengagementEmailData
): Promise<boolean> {
  const language = data.language || "ko"
  const t = REENGAGEMENT_TEXTS[language]
  const name = data.firstName || t.defaultName

  const subject = typeof t.subject === "function"
    ? t.subject(name, data.leadCount)
    : t.subjectFallback

  logger.info(`[Loops] Preparing reengagement email for ${data.email}`)

  try {
    const content = createReengagementEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: "Rinda",
      to: data.email,
      subject,
      body: JSON.stringify({ content }),
    })

    return response.success
  } catch (error) {
    logger.error(`[Loops] Failed to send reengagement email: ${error}`)
    return false
  }
}
```

### Step 2.4: 워커 생성

**파일:** `elysia-server/src/workers/bullmq/reengagement-email.worker.ts`

```typescript
/**
 * Reengagement Email Worker
 *
 * 매일 오전 10시(KST)에 실행되어 비활성 사용자에게 재참여 이메일 발송
 *
 * 비활성 조건:
 * - 온보딩 완료 후 24시간 경과
 * - 이메일 계정 미연결
 * - 캠페인 미시작
 * - 재참여 이메일 미발송
 */

import { type Job, Queue, Worker } from "bullmq"
import { and, eq, isNull, lt, notExists } from "drizzle-orm"
import { db } from "../../db"
import { onboardingProgress } from "../../db/schema/onboarding"
import { subscriptions } from "../../db/schema/billing"
import { userEmailAccounts } from "../../db/schema/email-accounts"
import { sequences } from "../../db/schema/sequences"
import { users } from "../../db/schema/users"
import { workspaces } from "../../db/schema/workspaces"
import { recordJobCompleted, recordJobFailed } from "../../lib/health"
import { createRedisConnection } from "../../lib/redis/connection"
import * as jobLogService from "../../services/job-log.service"
import { isLoopsConfigured, sendReengagementEmail } from "../../services/loops.service"
import { config } from "../../config"
import logger from "../../utils/logger"

const QUEUE_NAME = "reengagement-email"
const WORKER_NAME = "reengagement-email-worker"

const jobStartTimes = new Map<string, number>()

export interface ReengagementJob {
  trigger: "scheduled" | "manual"
  checkDate?: string
}

export interface ReengagementResult {
  success: boolean
  sentCount: number
  skippedCount: number
  errors: string[]
}

let worker: Worker<ReengagementJob, ReengagementResult> | null = null
let queue: Queue<ReengagementJob> | null = null

/**
 * 비활성 사용자 처리
 */
async function processReengagementEmails(
  job: Job<ReengagementJob, ReengagementResult>
): Promise<ReengagementResult> {
  const { trigger, checkDate } = job.data
  const now = checkDate ? new Date(checkDate) : new Date()
  const jobId = job.id || "unknown"
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const startTime = Date.now()
  jobStartTimes.set(jobId, startTime)

  logger.info(
    { jobId, trigger, now: now.toISOString() },
    "[ReengagementWorker] Starting"
  )

  try {
    await jobLogService.logJobStarted(job, WORKER_NAME)
  } catch (e) {
    logger.warn({ jobId, error: e }, "[ReengagementWorker] Failed to log start")
  }

  if (!isLoopsConfigured()) {
    logger.info("[ReengagementWorker] Loops not configured, skipping")
    return { success: true, sentCount: 0, skippedCount: 0, errors: [] }
  }

  const errors: string[] = []
  let sentCount = 0
  let skippedCount = 0

  try {
    // 비활성 사용자 조회
    // 조건: 온보딩 완료 24시간 경과 + 이메일 미연결 + 재참여 미발송
    const inactiveUsers = await db
      .select({
        onboardingId: onboardingProgress.id,
        workspaceId: onboardingProgress.workspaceId,
        completedAt: onboardingProgress.completedAt,
        surveyData: onboardingProgress.surveyData,
        selectedLeadIds: onboardingProgress.selectedLeadIds,
        userId: workspaces.ownerId,
        userName: users.username,
        userEmail: users.email,
      })
      .from(onboardingProgress)
      .innerJoin(workspaces, eq(workspaces.id, onboardingProgress.workspaceId))
      .innerJoin(users, eq(users.id, workspaces.ownerId))
      .where(
        and(
          // 온보딩 완료됨
          eq(onboardingProgress.status, "completed"),
          // 24시간 전 완료
          lt(onboardingProgress.completedAt, yesterday),
          // 재참여 이메일 미발송
          isNull(onboardingProgress.reengagementEmailSentAt)
        )
      )

    logger.info(
      { count: inactiveUsers.length },
      "[ReengagementWorker] Found inactive users"
    )

    for (const user of inactiveUsers) {
      try {
        // 이메일 연결 확인
        const emailAccount = await db
          .select({ id: userEmailAccounts.id })
          .from(userEmailAccounts)
          .where(eq(userEmailAccounts.workspaceId, user.workspaceId))
          .limit(1)

        if (emailAccount.length > 0) {
          logger.debug(
            { email: user.userEmail },
            "[ReengagementWorker] User has email connected, skipping"
          )
          skippedCount++
          continue
        }

        // 활성 캠페인 확인
        const activeSequence = await db
          .select({ id: sequences.id })
          .from(sequences)
          .where(
            and(
              eq(sequences.workspaceId, user.workspaceId),
              eq(sequences.status, "active")
            )
          )
          .limit(1)

        if (activeSequence.length > 0) {
          logger.debug(
            { email: user.userEmail },
            "[ReengagementWorker] User has active campaign, skipping"
          )
          skippedCount++
          continue
        }

        // 체험판 잔여 기간 계산
        const subscription = await db
          .select({ trialEnd: subscriptions.trialEnd })
          .from(subscriptions)
          .where(eq(subscriptions.workspaceId, user.workspaceId))
          .limit(1)

        const trialDaysRemaining = subscription[0]?.trialEnd
          ? Math.max(0, Math.ceil(
              (new Date(subscription[0].trialEnd).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
            ))
          : undefined

        // 리드 수 계산
        const leadIds = (user.selectedLeadIds as string[]) || []
        const leadCount = leadIds.length
        const emailCount = leadCount * 3

        // 언어 설정
        const surveyData = user.surveyData as { lang?: string } | null
        const lang = surveyData?.lang === "en" ? "en" : "ko"

        // 이메일 발송
        const success = await sendReengagementEmail({
          email: user.userEmail,
          firstName: user.userName || undefined,
          leadCount,
          emailCount,
          dashboardUrl: `${config.frontendUrl}/company?step=4`,
          language: lang,
          trialDaysRemaining,
        })

        if (success) {
          // 발송 기록 저장
          await db
            .update(onboardingProgress)
            .set({
              reengagementEmailSentAt: now,
              updatedAt: now,
            })
            .where(eq(onboardingProgress.id, user.onboardingId))

          sentCount++
          logger.info(
            { email: user.userEmail },
            "[ReengagementWorker] Sent reengagement email"
          )
        } else {
          errors.push(`Failed to send to ${user.userEmail}`)
        }
      } catch (error) {
        const errorMsg = `Error processing ${user.userEmail}: ${error}`
        errors.push(errorMsg)
        logger.error({ error, email: user.userEmail }, errorMsg)
      }
    }

    logger.info(
      { sentCount, skippedCount, errorCount: errors.length },
      "[ReengagementWorker] Completed"
    )

    return {
      success: errors.length === 0,
      sentCount,
      skippedCount,
      errors,
    }
  } catch (error) {
    logger.error({ error }, "[ReengagementWorker] Fatal error")
    throw error
  }
}

/**
 * 워커 시작
 */
export function startReengagementEmailWorker(): Worker<
  ReengagementJob,
  ReengagementResult
> | null {
  if (worker) {
    logger.warn("[ReengagementWorker] Already running")
    return worker
  }

  try {
    const connection = createRedisConnection()

    // Queue 생성
    queue = new Queue<ReengagementJob>(QUEUE_NAME, { connection })

    // Worker 생성
    worker = new Worker<ReengagementJob, ReengagementResult>(
      QUEUE_NAME,
      processReengagementEmails,
      {
        connection,
        concurrency: 1,
        limiter: {
          max: 1,
          duration: 60000,
        },
      }
    )

    // Event Handlers
    worker.on("completed", async (job, result) => {
      const jobId = job.id || "unknown"
      const startTime = jobStartTimes.get(jobId) || Date.now()

      recordJobCompleted()

      try {
        await jobLogService.logJobCompleted(job, result, startTime)
      } catch (e) {
        logger.error({ jobId, error: e }, "[ReengagementWorker] Log failed")
      } finally {
        jobStartTimes.delete(jobId)
      }

      logger.info({ jobId, result }, "[ReengagementWorker] Job completed")
    })

    worker.on("failed", async (job, err) => {
      const jobId = job?.id
      const startTime = jobId ? jobStartTimes.get(jobId) : undefined

      recordJobFailed()

      try {
        await jobLogService.logJobFailed(job, err, startTime)
      } catch (e) {
        logger.error({ jobId, error: e }, "[ReengagementWorker] Log failed")
      } finally {
        if (jobId) jobStartTimes.delete(jobId)
      }

      logger.error({ jobId, error: err.message }, "[ReengagementWorker] Failed")
    })

    worker.on("stalled", async (jobId) => {
      try {
        await jobLogService.logJobStalled(jobId, QUEUE_NAME)
      } catch (e) {
        logger.error({ jobId, error: e }, "[ReengagementWorker] Stall log failed")
      }
      logger.warn({ jobId }, "[ReengagementWorker] Stalled")
    })

    worker.on("error", (err) => {
      logger.error({ error: err.message }, "[ReengagementWorker] Error")
    })

    logger.info("[ReengagementWorker] Started")
    return worker
  } catch (error) {
    logger.error({ error }, "[ReengagementWorker] Failed to start")
    return null
  }
}

/**
 * 스케줄 설정
 */
export async function setupReengagementSchedule(): Promise<void> {
  if (!queue) {
    logger.warn("[ReengagementWorker] Queue not initialized")
    return
  }

  try {
    // 기존 반복 작업 제거
    const repeatableJobs = await queue.getRepeatableJobs()
    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key)
    }

    // 매일 오전 10시 (KST = UTC+9) 실행
    // UTC 01:00 = KST 10:00
    await queue.add(
      "daily-reengagement",
      { trigger: "scheduled" },
      {
        repeat: {
          pattern: "0 1 * * *",  // 매일 UTC 01:00
        },
      }
    )

    logger.info("[ReengagementWorker] Schedule set for 10:00 KST daily")
  } catch (error) {
    logger.error({ error }, "[ReengagementWorker] Failed to setup schedule")
  }
}

/**
 * 워커 중지
 */
export async function stopReengagementEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close()
    worker = null
  }
  if (queue) {
    await queue.close()
    queue = null
  }
  logger.info("[ReengagementWorker] Stopped")
}

/**
 * 상태 확인
 */
export function getReengagementEmailWorkerStatus(): {
  running: boolean
} {
  return {
    running: worker !== null && !worker.closing,
  }
}
```

### Step 2.5: 워커 export 추가

**파일:** `elysia-server/src/workers/bullmq/index.ts`

```typescript
// 기존 export들...
export {
  getOnboardingAutoGenerateWorkerStatus,
  onboardingWorker,
  startOnboardingAutoGenerateWorker,
  stopOnboardingAutoGenerateWorker,
} from "./onboarding-auto-generate.worker"

// ... 기타 export들 ...

// 🆕 추가
export {
  getReengagementEmailWorkerStatus,
  setupReengagementSchedule,
  startReengagementEmailWorker,
  stopReengagementEmailWorker,
} from "./reengagement-email.worker"
```

### Step 2.6: 앱 시작 시 워커 초기화

**파일:** 앱 엔트리 포인트 (예: `src/index.ts` 또는 `src/app.ts`)

```typescript
import {
  startReengagementEmailWorker,
  setupReengagementSchedule,
} from "./workers/bullmq"

// 앱 시작 시
async function bootstrap() {
  // ... 기존 초기화 ...

  // 🆕 재참여 이메일 워커 시작
  startReengagementEmailWorker()
  await setupReengagementSchedule()

  // ...
}
```

---

## 환경 변수 (추가 필요 없음)

현재 `config.ts`의 Loops 설정을 그대로 사용:

```typescript
loops: {
  apiKey: getEnvOrDefault("LOOPS_API_KEY", ""),
  transactionalIds: {
    onboardingComplete: getEnvOrDefault(
      "LOOPS_TRANSACTIONAL_ONBOARDING_COMPLETE",
      "cmjju1bio06vt0hzt094zh3a4"
    ),
  },
}
```

---

## 파일 변경 요약

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `db/schema/onboarding.ts` | 수정 | `reengagementEmailSentAt` 필드 추가 |
| `drizzle/XXXX_add_reengagement_email.sql` | 신규 | 마이그레이션 |
| `services/loops.service.ts` | 수정 | 인터페이스 확장, 동적 제목줄, 재참여 이메일 함수 |
| `services/onboarding-worker.service.ts` | 수정 | 발송 데이터 확장 |
| `workers/bullmq/reengagement-email.worker.ts` | 신규 | 재참여 이메일 워커 |
| `workers/bullmq/index.ts` | 수정 | 워커 export 추가 |
| 앱 엔트리 포인트 | 수정 | 워커 초기화 추가 |

---

## 구현 순서 및 체크리스트

### Phase 1: Email 1 최적화 (3일)

- [ ] 1.1 `OnboardingCompleteEmailData` 인터페이스 확장
- [ ] 1.2 `EMAIL_TEXTS` 수정 (동적 제목줄, 새 필드)
- [ ] 1.3 `sendOnboardingCompleteEmail` 함수 수정
- [ ] 1.4 `onboarding-worker.service.ts` 발송 로직 수정
- [ ] 1.5 `createOnboardingCompleteEmailHTML` 템플릿 업데이트
- [ ] 1.6 로컬 테스트
- [ ] 1.7 스테이징 테스트

### Phase 2: Email 2 신규 구현 (5일)

- [ ] 2.1 `onboarding.ts` 스키마 수정
- [ ] 2.2 DB 마이그레이션 생성 및 실행
- [ ] 2.3 `loops.service.ts`에 재참여 이메일 타입/함수 추가
- [ ] 2.4 `reengagement-email.worker.ts` 생성
- [ ] 2.5 `workers/bullmq/index.ts` export 추가
- [ ] 2.6 앱 엔트리에 워커 초기화 추가
- [ ] 2.7 로컬 테스트 (수동 트리거)
- [ ] 2.8 스테이징 테스트 (스케줄 확인)

---

## 테스트 방법

### Email 1 테스트

```typescript
// 테스트용 더미 데이터
const testData = {
  email: "test@example.com",
  firstName: "철희",
  leadCount: 148,
  emailCount: 444,
  dashboardUrl: "https://app.rinda.ai/company?step=4",
  language: "ko" as const,
  trialDaysRemaining: 7,
  industry: "뷰티/화장품",
  topCompanies: ["ABC Corp", "XYZ Inc", "DEF Ltd"],
}

// 발송 테스트
await sendOnboardingCompleteEmail(testData)
```

### Email 2 테스트 (수동 트리거)

```typescript
import { Queue } from "bullmq"
import { createRedisConnection } from "./lib/redis/connection"

const queue = new Queue("reengagement-email", {
  connection: createRedisConnection(),
})

// 수동 트리거
await queue.add("manual-test", {
  trigger: "manual",
  checkDate: new Date().toISOString(),
})
```

---

## 모니터링

### 로그 확인

```bash
# Email 1 로그
grep "Loops.*Preparing email" logs/app.log

# Email 2 로그
grep "ReengagementWorker" logs/app.log
```

### BullMQ 대시보드

- Arena 또는 Bull Board를 통해 `reengagement-email` 큐 모니터링
- 실패한 작업 재시도

### DB 확인

```sql
-- 재참여 이메일 발송 현황
SELECT
  COUNT(*) as total,
  COUNT(reengagement_email_sent_at) as sent,
  COUNT(*) - COUNT(reengagement_email_sent_at) as pending
FROM onboarding_progress
WHERE status = 'completed';
```
